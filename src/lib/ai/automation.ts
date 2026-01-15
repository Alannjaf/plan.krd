/**
 * AI Automation Core Logic
 * Automates routine task management operations
 */

import { createClient } from "@/lib/supabase/server";
import { chatCompletion, parseJsonResponse, type Message } from "@/lib/ai/openrouter";
import { logger } from "@/lib/utils/logger";

export type AssigneeSuggestion = {
  user_id: string;
  user_name: string;
  confidence: number;
  reasoning: string;
  match_factors: string[];
};

export type DuplicateTask = {
  task_id: string;
  duplicate_task_id: string;
  similarity_score: number;
  matching_fields: string[];
  task_title: string;
  duplicate_title: string;
};

export type ReminderContext = {
  task_id: string;
  task_title: string;
  due_date?: string;
  priority?: string;
  assignees?: string[];
  days_until_due?: number;
};

/**
 * Suggest best assignee for a task based on skills, workload, and history
 */
export async function suggestAssignee(
  taskId: string,
  context?: {
    title?: string;
    description?: string;
    priority?: string;
    board_id?: string;
  }
): Promise<{ success: boolean; suggestions?: AssigneeSuggestion[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get task details
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        priority,
        list_id,
        lists!inner(board_id, boards(workspace_id))
      `)
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: "Task not found" };
    }

    // Handle nested query result types
    const listsData = task.lists as unknown;
    let boardId: string | undefined;
    let workspaceId: string | undefined;

    if (listsData) {
      if (Array.isArray(listsData)) {
        const firstList = listsData[0] as { board_id: string; boards: { workspace_id: string } | { workspace_id: string }[] } | undefined;
        boardId = firstList?.board_id;
        const boardsData = firstList?.boards;
        if (boardsData) {
          workspaceId = Array.isArray(boardsData) ? boardsData[0]?.workspace_id : boardsData.workspace_id;
        }
      } else if (typeof listsData === 'object') {
        const listObj = listsData as { board_id: string; boards: { workspace_id: string } | { workspace_id: string }[] };
        boardId = listObj.board_id;
        const boardsData = listObj.boards;
        if (boardsData) {
          workspaceId = Array.isArray(boardsData) ? boardsData[0]?.workspace_id : boardsData.workspace_id;
        }
      }
    }

    if (!boardId || !workspaceId) {
      return { success: false, error: "Board or workspace not found" };
    }

    // Get workspace members
    const { data: members, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("workspace_id", workspaceId);

    if (membersError || !members) {
      return { success: false, error: "Failed to fetch workspace members" };
    }

    // Get each member's task history and current workload
    const memberData = await Promise.all(
      members.map(async (member) => {
        const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
        const userName = profile?.full_name || profile?.email || "Unknown";

        // Get current active tasks
        const { data: currentTasks } = await supabase
          .from("task_assignees")
          .select("task_id")
          .eq("user_id", member.user_id)
          .limit(100);

        // Get similar completed tasks
        const { data: similarTasks } = await supabase
          .from("task_assignees")
          .select(`
            task_id,
            tasks!inner(id, title, description, completed, priority)
          `)
          .eq("user_id", member.user_id)
          .eq("tasks.completed", true)
          .eq("tasks.archived", false)
          .limit(20);

        const similarTaskTitles = similarTasks?.map((st) => {
          const task = Array.isArray(st.tasks) ? st.tasks[0] : st.tasks;
          return task?.title || "";
        }) || [];

        return {
          user_id: member.user_id,
          user_name: userName,
          current_task_count: currentTasks?.length || 0,
          similar_task_titles: similarTaskTitles,
        };
      })
    );

    // Build AI prompt
    const prompt = `Suggest the best assignee for this task:

Task title: ${context?.title || task.title}
Task description: ${context?.description || task.description || "None"}
Priority: ${context?.priority || task.priority || "medium"}

Available team members and their context:
${JSON.stringify(memberData, null, 2)}

Consider:
1. Skill/expertise matching (based on similar tasks they've completed)
2. Current workload (prefer members with fewer current tasks)
3. Task priority (urgent tasks to available members)
4. Historical patterns (members who frequently handle similar tasks)

Return JSON array of suggestions (top 3):
[
  {
    "user_id": "user-id",
    "user_name": "Name",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation",
    "match_factors": ["factor1", "factor2"]
  }
]`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a task assignment expert. Match tasks to team members based on skills, workload, and historical patterns.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.4 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to generate suggestions" };
    }

    const suggestions = parseJsonResponse<AssigneeSuggestion[]>(result.content);

    if (!suggestions || !Array.isArray(suggestions)) {
      return { success: false, error: "Failed to parse AI response" };
    }

    // Validate and filter suggestions
    const validSuggestions = suggestions
      .filter(
        (s) =>
          s.user_id &&
          s.user_name &&
          typeof s.confidence === "number" &&
          s.confidence > 0 &&
          Array.isArray(s.match_factors)
      )
      .slice(0, 3); // Limit to top 3

    return { success: true, suggestions: validSuggestions };
  } catch (error) {
    logger.error("Error suggesting assignee", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Automatically assign a task based on rules
 */
export async function autoAssignTask(
  taskId: string,
  rules?: {
    prefer_available?: boolean;
    match_skills?: boolean;
    balance_workload?: boolean;
  }
): Promise<{ success: boolean; assigned_to?: string; error?: string }> {
  const suggestionResult = await suggestAssignee(taskId);

  if (!suggestionResult.success || !suggestionResult.suggestions || suggestionResult.suggestions.length === 0) {
    return { success: false, error: "No suitable assignee found" };
  }

  // Use the top suggestion
  const topSuggestion = suggestionResult.suggestions[0];
  
  // Apply rules if provided
  let selectedSuggestion = topSuggestion;
  if (rules) {
    if (rules.prefer_available) {
      // Prefer suggestions with lower current task count
      const availableSuggestion = suggestionResult.suggestions.find((s) => {
        // This would require additional data, simplified for now
        return s.confidence >= 0.7;
      });
      if (availableSuggestion) {
        selectedSuggestion = availableSuggestion;
      }
    }
  }

  return {
    success: true,
    assigned_to: selectedSuggestion.user_id,
  };
}

/**
 * Detect duplicate tasks in a board
 */
export async function detectDuplicates(
  boardId: string,
  taskTitle?: string,
  taskId?: string
): Promise<{ success: boolean; duplicates?: DuplicateTask[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get all tasks in the board
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, description, list_id, lists!inner(board_id)")
      .eq("lists.board_id", boardId)
      .eq("archived", false)
      .eq("completed", false);

    if (tasksError || !tasks) {
      return { success: false, error: "Failed to fetch tasks" };
    }

    // If specific task provided, compare only with that
    const tasksToCompare = taskId
      ? tasks.filter((t) => t.id !== taskId)
      : tasks;

    if (tasksToCompare.length === 0) {
      return { success: true, duplicates: [] };
    }

    // Build comparison context
    const taskContext = tasksToCompare.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
    }));

    const targetTask = taskId
      ? tasks.find((t) => t.id === taskId)
      : { title: taskTitle || "", description: "" };

    if (!targetTask) {
      return { success: false, error: "Target task not found" };
    }

    // Build AI prompt
    const prompt = `Find duplicate or very similar tasks:

Target task:
Title: ${targetTask.title}
Description: ${targetTask.description || "None"}

Tasks to compare against:
${JSON.stringify(taskContext.slice(0, 50), null, 2)}

Identify duplicates based on:
- Similar titles (same meaning, different wording)
- Similar descriptions
- Same intent/purpose

Return JSON array:
[
  {
    "task_id": "${taskId || "target-task-id"}",
    "duplicate_task_id": "duplicate-id",
    "similarity_score": 0.0-1.0,
    "matching_fields": ["title", "description"],
    "task_title": "${targetTask.title}",
    "duplicate_title": "Duplicate task title"
  }
]

Only include tasks with similarity_score >= 0.7.`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a duplicate detection expert. Identify tasks that are duplicates or very similar based on title and description similarity.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.2 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to detect duplicates" };
    }

    const duplicates = parseJsonResponse<DuplicateTask[]>(result.content);

    if (!duplicates || !Array.isArray(duplicates)) {
      return { success: false, error: "Failed to parse AI response" };
    }

    // Validate and filter
    const validDuplicates = duplicates.filter(
      (d) =>
        d.task_id &&
        d.duplicate_task_id &&
        typeof d.similarity_score === "number" &&
        d.similarity_score >= 0.7
    );

    return { success: true, duplicates: validDuplicates };
  } catch (error) {
    logger.error("Error detecting duplicates", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate contextual reminder for a task
 */
export async function generateReminder(
  taskId: string,
  context: ReminderContext
): Promise<{ success: boolean; reminder?: string; error?: string }> {
  try {
    const prompt = `Generate a contextual reminder message for this task:

Task: ${context.task_title}
Due date: ${context.due_date || "Not set"}
Priority: ${context.priority || "medium"}
Days until due: ${context.days_until_due !== undefined ? context.days_until_due : "N/A"}
Assignees: ${context.assignees?.join(", ") || "Unassigned"}

Generate a friendly, actionable reminder that:
- Is contextually appropriate (urgent vs. casual)
- Includes relevant details (due date, priority)
- Suggests action if needed
- Is concise (1-2 sentences)

Return only the reminder message text, no JSON.`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a helpful assistant that generates contextual task reminders. Make them friendly, actionable, and appropriate for the situation.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.7 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to generate reminder" };
    }

    return { success: true, reminder: result.content.trim() };
  } catch (error) {
    logger.error("Error generating reminder", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
