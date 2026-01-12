"use server";

import { createClient } from "@/lib/supabase/server";
import {
  chatCompletion,
  parseJsonResponse,
  type Message,
} from "@/lib/ai/openrouter";
import {
  SYSTEM_PROMPTS,
  buildChatContext,
  buildDecomposePrompt,
  buildAutoTagPrompt,
  buildDocumentChatPrompt,
  parseAIAction,
  parseAIActions,
  parseReportRequest,
  type AIAction,
  type ChatContext,
  type ReportRequest,
} from "@/lib/ai/prompts";
import { createTask, updateTask, deleteTask, moveTask, completeTask, uncompleteTask } from "./tasks";
import { addAssignee, removeAssignee } from "./assignees";
import { addLabelToTask, removeLabelFromTask } from "./labels";
import { generateTaskReport } from "./reports";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type DecomposedSubtask = {
  title: string;
  due_date?: string; // YYYY-MM-DD format
  assignee_id?: string; // User ID for suggested assignee
};

export type AutoTagSuggestion = {
  priority: "low" | "medium" | "high" | "urgent";
  labels: string[];
  assignees?: string[]; // User IDs
  due_date?: string; // YYYY-MM-DD format
  custom_fields?: Record<string, string>; // field_id -> value
  reasoning: string;
};

type SimilarTaskPattern = {
  assignee_ids: string[]; // Most common assignees
  avg_days_to_deadline: number | null; // Average days from creation to deadline
  common_priorities: Record<string, number>; // Priority frequency
  common_labels: string[]; // Most common labels
  custom_field_patterns: Record<string, { value: string; frequency: number }[]>; // Field value patterns
  count: number; // Number of similar tasks found
};

export type AssigneeRule = {
  frequency: number; // 0.0 to 1.0
  common_keywords: string[];
  last_assigned: string;
  task_count: number;
};

export type DeadlineRules = {
  avg_days_to_deadline: number | null;
  priority_deadlines: Record<string, number>;
};

export type PriorityRules = {
  keyword_patterns: Record<string, string[]>;
  label_priorities: Record<string, string>;
};

export type LabelRules = {
  common_labels: string[];
  keyword_labels: Record<string, string>;
};

export type CustomFieldRule = {
  common_values: string[];
  frequencies: number[];
};

export type BoardGuidelines = {
  assignee_rules: Record<string, AssigneeRule>;
  deadline_rules: DeadlineRules;
  priority_rules: PriorityRules;
  label_rules: LabelRules;
  custom_field_rules: Record<string, CustomFieldRule>;
  metadata: {
    last_updated: string;
    total_tasks_analyzed: number;
    version: number;
  };
};

/**
 * Translate database/technical errors into user-friendly messages
 */
function translateError(error: string, actionType: string): string {
  const errorLower = error.toLowerCase();
  
  // Duplicate key / already exists errors
  if (errorLower.includes("duplicate") || errorLower.includes("already exists") || errorLower.includes("unique constraint")) {
    switch (actionType) {
      case "ADD_ASSIGNEE":
        return "This user is already assigned to the task";
      case "ADD_LABEL":
        return "This label is already on the task";
      case "CREATE_TASK":
        return "A task with this name already exists";
      default:
        return "This item already exists";
    }
  }
  
  // Not found errors
  if (errorLower.includes("not found") || errorLower.includes("no rows") || errorLower.includes("does not exist")) {
    switch (actionType) {
      case "REMOVE_ASSIGNEE":
        return "This user is not assigned to the task";
      case "REMOVE_LABEL":
        return "This label is not on the task";
      case "UPDATE_TASK":
      case "DELETE_TASK":
      case "MOVE_TASK":
      case "COMPLETE_TASK":
        return "Task not found - it may have been deleted";
      default:
        return "The item was not found";
    }
  }
  
  // Permission errors
  if (errorLower.includes("permission") || errorLower.includes("unauthorized") || errorLower.includes("forbidden")) {
    return "You don't have permission to perform this action";
  }
  
  // Validation errors
  if (errorLower.includes("invalid") || errorLower.includes("required")) {
    return "Invalid input - please check your request";
  }
  
  // Return original error if no translation found
  return error;
}

/**
 * Execute an AI action and return a human-readable response
 */
async function executeAIAction(
  action: AIAction,
  context: { boardId?: string; workspaceId?: string }
): Promise<{ success: boolean; message: string; actionExecuted?: boolean }> {
  try {
    switch (action.action) {
      case "CREATE_TASK": {
        const { title, listId, priority, dueDate, description } = action.params;
        if (!listId) {
          return { success: false, message: "No list specified for task creation." };
        }
        const result = await createTask(listId, title, {
          priority: priority as "low" | "medium" | "high" | "urgent" | undefined,
          due_date: dueDate,
          description,
        });
        if (result.success) {
          let msg = `✅ Created task "${title}"`;
          if (priority) msg += ` with ${priority} priority`;
          if (dueDate) msg += `, due ${dueDate}`;
          return { success: true, message: msg, actionExecuted: true };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "CREATE_TASK")}` };
      }

      case "UPDATE_TASK": {
        const { taskId, title, description, priority, dueDate } = action.params;
        const updates: {
          title?: string;
          description?: string | null;
          priority?: "low" | "medium" | "high" | "urgent" | null;
          due_date?: string | null;
        } = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (priority !== undefined) updates.priority = priority;
        if (dueDate !== undefined) updates.due_date = dueDate;

        const result = await updateTask(taskId, updates);
        if (result.success) {
          const changes: string[] = [];
          if (title) changes.push(`title to "${title}"`);
          if (description) changes.push("description");
          if (priority) changes.push(`priority to ${priority}`);
          if (dueDate) changes.push(`due date to ${dueDate}`);
          return {
            success: true,
            message: `✅ Updated task: ${changes.join(", ")}`,
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "UPDATE_TASK")}` };
      }

      case "DELETE_TASK": {
        const { taskId, taskTitle } = action.params;
        const result = await deleteTask(taskId);
        if (result.success) {
          return {
            success: true,
            message: `✅ Deleted task "${taskTitle}"`,
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "DELETE_TASK")}` };
      }

      case "MOVE_TASK": {
        const { taskId, listId, listName } = action.params;
        const result = await moveTask(taskId, listId, 0);
        if (result.success) {
          return {
            success: true,
            message: `✅ Moved task to "${listName}" list`,
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "MOVE_TASK")}` };
      }

      case "COMPLETE_TASK": {
        const { taskId, completed } = action.params;
        const result = completed 
          ? await completeTask(taskId)
          : await uncompleteTask(taskId);
        if (result.success) {
          return {
            success: true,
            message: completed ? "✅ Marked task as complete" : "✅ Marked task as incomplete",
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "COMPLETE_TASK")}` };
      }

      case "ADD_ASSIGNEE": {
        const { taskId, userId, userName } = action.params;
        const result = await addAssignee(taskId, userId);
        if (result.success) {
          return {
            success: true,
            message: `✅ Assigned ${userName} to the task`,
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "ADD_ASSIGNEE")}` };
      }

      case "REMOVE_ASSIGNEE": {
        const { taskId, userId, userName } = action.params;
        const result = await removeAssignee(taskId, userId);
        if (result.success) {
          return {
            success: true,
            message: `✅ Removed ${userName} from the task`,
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "REMOVE_ASSIGNEE")}` };
      }

      case "ADD_LABEL": {
        const { taskId, labelId, labelName } = action.params;
        const result = await addLabelToTask(taskId, labelId);
        if (result.success) {
          return {
            success: true,
            message: `✅ Added label "${labelName}" to the task`,
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "ADD_LABEL")}` };
      }

      case "REMOVE_LABEL": {
        const { taskId, labelId, labelName } = action.params;
        const result = await removeLabelFromTask(taskId, labelId);
        if (result.success) {
          return {
            success: true,
            message: `✅ Removed label "${labelName}" from the task`,
            actionExecuted: true,
          };
        }
        return { success: false, message: `❌ ${translateError(result.error || "Unknown error", "REMOVE_LABEL")}` };
      }

      default:
        return { success: false, message: "❌ Unknown action type" };
    }
  } catch (error) {
    console.error("[AI Action] Error executing action:", error);
    const errorMessage = (error as Error).message || "An unexpected error occurred";
    return { success: false, message: `❌ ${translateError(errorMessage, action.action)}` };
  }
}

/**
 * Chat with AI assistant about tasks
 */
export async function chatWithAssistant(
  message: string,
  conversationHistory: ChatMessage[],
  context: {
    workspaceId?: string;
    boardId?: string;
  }
): Promise<{ success: boolean; response?: string; error?: string; actionExecuted?: boolean }> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // Build context based on workspace/board
  const contextData: ChatContext = {
    userName: profile?.full_name || profile?.email || undefined,
  };

  let workspaceIdForMembers: string | undefined;

  // If board context, get board tasks
  if (context.boardId) {
    const { data: board } = await supabase
      .from("boards")
      .select("name, workspace_id, workspaces(name)")
      .eq("id", context.boardId)
      .single();

    if (board) {
      contextData.boardName = board.name;
      workspaceIdForMembers = board.workspace_id;
      // Handle workspaces as it can be an array or object from Supabase
      const workspaceData = board.workspaces;
      const workspace = Array.isArray(workspaceData) 
        ? workspaceData[0] as { name: string } | undefined
        : workspaceData as { name: string } | null;
      contextData.workspaceName = workspace?.name;
    }

    // Get lists for this board
    const { data: lists } = await supabase
      .from("lists")
      .select("id, name")
      .eq("board_id", context.boardId)
      .order("position");

    if (lists && lists.length > 0) {
      contextData.lists = lists.map((l) => ({ id: l.id, name: l.name }));
    }

    // Get labels for this board
    const { data: labels } = await supabase
      .from("labels")
      .select("id, name, color")
      .eq("board_id", context.boardId);

    if (labels && labels.length > 0) {
      contextData.labels = labels.map((l) => ({ id: l.id, name: l.name, color: l.color }));
    }

    const listIds = lists?.map((l) => l.id) || [];
    const listNameMap = new Map(lists?.map((l) => [l.id, l.name]) || []);

    if (listIds.length > 0) {
      // Get tasks for those lists
      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          due_date,
          priority,
          archived,
          completed,
          list_id
        `)
        .in("list_id", listIds)
        .eq("archived", false)
        .limit(100);

      if (tasks) {
        contextData.tasks = tasks.map((t) => {
          const listName = listNameMap.get(t.list_id) || "unknown";

          return {
            id: t.id,
            title: t.title,
            description: t.description,
            due_date: t.due_date,
            priority: t.priority,
            status: t.completed ? "completed" : listName,
            assignees: [],
          };
        });
      }
    }
  } else if (context.workspaceId) {
    workspaceIdForMembers = context.workspaceId;

    // Get workspace info
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", context.workspaceId)
      .single();

    if (workspace) {
      contextData.workspaceName = workspace.name;
    }

    // Get all boards in this workspace
    const { data: boards } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", context.workspaceId);

    const boardIds = boards?.map((b) => b.id) || [];

    if (boardIds.length > 0) {
      // Get all lists for those boards
      const { data: lists } = await supabase
        .from("lists")
        .select("id, name, board_id")
        .in("board_id", boardIds)
        .order("position");

      if (lists && lists.length > 0) {
        contextData.lists = lists.map((l) => ({ id: l.id, name: l.name }));
      }

      const listIds = lists?.map((l) => l.id) || [];
      const listNameMap = new Map(lists?.map((l) => [l.id, l.name]) || []);

      if (listIds.length > 0) {
        // Get tasks for those lists
        const { data: tasks } = await supabase
          .from("tasks")
          .select(`
            id,
            title,
            description,
            due_date,
            priority,
            archived,
            completed,
            list_id
          `)
          .in("list_id", listIds)
          .eq("archived", false)
          .limit(100);

        if (tasks) {
          contextData.tasks = tasks.map((t) => {
            const listName = listNameMap.get(t.list_id) || "unknown";

            return {
              id: t.id,
              title: t.title,
              description: t.description,
              due_date: t.due_date,
              priority: t.priority,
              status: t.completed ? "completed" : listName,
              assignees: [],
            };
          });
        }
      }
    }
  }

  // Get workspace members
  if (workspaceIdForMembers) {
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("workspace_id", workspaceIdForMembers);

    if (members && members.length > 0) {
      contextData.members = members.map((m) => {
        const profileData = m.profiles;
        const profile = Array.isArray(profileData) ? profileData[0] : profileData;
        return {
          id: m.user_id,
          name: (profile as { full_name?: string; email?: string })?.full_name || 
                (profile as { email?: string })?.email || "Unknown",
          email: (profile as { email?: string })?.email,
        };
      });
    }
  }

  // Build messages for the AI
  const contextString = buildChatContext(contextData);
  
  // Debug logging
  console.log("[AI Chat] Context:", {
    boardId: context.boardId,
    workspaceId: context.workspaceId,
    taskCount: contextData.tasks?.length ?? 0,
    listCount: contextData.lists?.length ?? 0,
    memberCount: contextData.members?.length ?? 0,
    labelCount: contextData.labels?.length ?? 0,
  });
  
  const messages: Message[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPTS.chatAssistant}\n\n--- Current Context ---\n${contextString}`,
    },
    // Add conversation history
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    // Add current message
    { role: "user" as const, content: message },
  ];

  // Use lower temperature for more consistent responses
  const result = await chatCompletion(messages, { temperature: 0.3 });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Check if the response contains a report request
  const reportRequest = parseReportRequest(result.content || "");
  
  if (reportRequest) {
    console.log("[AI Chat] Report request detected:", reportRequest);
    
    // Generate the report
    const reportResult = await generateTaskReport({
      boardId: context.boardId,
      workspaceId: context.workspaceId,
      filters: {
        completed: reportRequest.filters?.completed, // undefined means all tasks
        dateRange: reportRequest.filters?.dateRange,
        assigneeId: reportRequest.filters?.assigneeId,
        labelId: reportRequest.filters?.labelId,
        priority: reportRequest.filters?.priority,
        listId: reportRequest.filters?.listId,
      },
      fields: reportRequest.fields || "all",
    });

    if (!reportResult.success) {
      return {
        success: false,
        error: reportResult.error || "Failed to generate report",
      };
    }

    // Return CSV in a special format that the chat widget can detect
    // We'll encode it as a special JSON response
    const csvResponse = {
      type: "csvReport",
      csv: reportResult.csv,
      message: `✅ Generated CSV report with ${reportResult.csv?.split("\n").length - 1 || 0} task${reportResult.csv?.split("\n").length - 1 !== 1 ? "s" : ""}`,
    };

    return {
      success: true,
      response: JSON.stringify(csvResponse),
    };
  }

  // Check if the response contains actions (single or multiple)
  const actions = parseAIActions(result.content || "");
  
  if (actions.length > 0) {
    console.log(`[AI Chat] ${actions.length} action(s) detected:`, actions);
    
    // Execute all actions sequentially
    const results = await Promise.all(
      actions.map((action) => executeAIAction(action, context))
    );
    
    // Aggregate results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const anyExecuted = results.some((r) => r.actionExecuted);
    
    // Build aggregated message
    let aggregatedMessage: string;
    
    if (actions.length === 1) {
      // Single action - use the original message format
      aggregatedMessage = results[0].message;
    } else {
      // Multiple actions - create summary
      if (failed.length === 0) {
        // All succeeded
        const actionType = actions[0].action;
        if (actionType === "MOVE_TASK" && actions.length > 0) {
          const listName = actions[0].params.listName || "target list";
          aggregatedMessage = `✅ Successfully moved ${successful.length} task${successful.length !== 1 ? "s" : ""} to "${listName}"`;
        } else if (actionType === "COMPLETE_TASK") {
          const completed = actions[0].params.completed;
          aggregatedMessage = `✅ ${completed ? "Marked" : "Unmarked"} ${successful.length} task${successful.length !== 1 ? "s" : ""} as ${completed ? "complete" : "incomplete"}`;
        } else if (actionType === "DELETE_TASK") {
          aggregatedMessage = `✅ Deleted ${successful.length} task${successful.length !== 1 ? "s" : ""}`;
        } else if (actionType === "ADD_ASSIGNEE") {
          const userName = actions[0].params.userName || "user";
          aggregatedMessage = `✅ Assigned ${userName} to ${successful.length} task${successful.length !== 1 ? "s" : ""}`;
        } else if (actionType === "REMOVE_ASSIGNEE") {
          const userName = actions[0].params.userName || "user";
          aggregatedMessage = `✅ Removed ${userName} from ${successful.length} task${successful.length !== 1 ? "s" : ""}`;
        } else if (actionType === "ADD_LABEL") {
          const labelName = actions[0].params.labelName || "label";
          aggregatedMessage = `✅ Added label "${labelName}" to ${successful.length} task${successful.length !== 1 ? "s" : ""}`;
        } else if (actionType === "REMOVE_LABEL") {
          const labelName = actions[0].params.labelName || "label";
          aggregatedMessage = `✅ Removed label "${labelName}" from ${successful.length} task${successful.length !== 1 ? "s" : ""}`;
        } else {
          aggregatedMessage = `✅ Successfully completed ${successful.length} action${successful.length !== 1 ? "s" : ""}`;
        }
      } else if (successful.length === 0) {
        // All failed
        const errorMsg = failed[0].message.replace(/^[✅❌⚠️]\s*/, "");
        aggregatedMessage = `❌ All actions failed: ${errorMsg}`;
      } else {
        // Partial success
        const actionType = actions[0].action;
        let baseMessage = "";
        if (actionType === "MOVE_TASK" && actions.length > 0) {
          const listName = actions[0].params.listName || "target list";
          baseMessage = `⚠️ Moved ${successful.length} task${successful.length !== 1 ? "s" : ""} to "${listName}"`;
        } else {
          baseMessage = `⚠️ Completed ${successful.length} action${successful.length !== 1 ? "s" : ""}`;
        }
        const errorMsg = failed[0].message.replace(/^[✅❌⚠️]\s*/, "");
        aggregatedMessage = `${baseMessage}, ${failed.length} failed: ${errorMsg}`;
      }
    }
    
    return {
      success: successful.length > 0,
      response: aggregatedMessage,
      actionExecuted: anyExecuted,
    };
  }

  return { success: true, response: result.content };
}

/**
 * Decompose a task into subtasks using AI
 */
export async function decomposeTask(
  taskId: string
): Promise<{ success: boolean; subtasks?: DecomposedSubtask[]; error?: string }> {
  const supabase = await createClient();

  // Get the task with deadline, list_id, and board info
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("title, description, due_date, created_at, list_id, lists(board_id, boards(workspace_id))")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return { success: false, error: "Task not found" };
  }

  // Extract board_id and workspace_id
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

  // Get parent task assignees
  const { data: assignees } = await supabase
    .from("task_assignees")
    .select("user_id, profiles(id, full_name, email)")
    .eq("task_id", taskId);

  const parentAssignees: Array<{ id: string; name: string }> = [];
  if (assignees) {
    for (const assignee of assignees) {
      const profileData = assignee.profiles;
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      const name = (profile as { full_name?: string; email?: string })?.full_name ||
                   (profile as { email?: string })?.email ||
                   "Unknown";
      parentAssignees.push({
        id: assignee.user_id,
        name,
      });
    }
  }

  // Get workspace members
  let workspaceMembers: Array<{ id: string; name: string }> = [];
  if (workspaceId) {
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("workspace_id", workspaceId);

    if (members) {
      workspaceMembers = members.map((m) => {
        const profileData = m.profiles;
        const profile = Array.isArray(profileData) ? profileData[0] : profileData;
        return {
          id: m.user_id,
          name:
            (profile as { full_name?: string; email?: string })?.full_name ||
            (profile as { email?: string })?.email ||
            "Unknown",
        };
      });
    }
  }

  // Try to get guidelines first (fast path)
  const { getBoardGuidelines } = await import("./guidelines");
  const guidelinesResult = boardId ? await getBoardGuidelines(boardId) : { success: false };
  const guidelines = guidelinesResult.success ? guidelinesResult.guidelines : undefined;

  // Find similar tasks to get assignee patterns
  // Use guidelines if available, otherwise fallback to database query
  let similarTaskPatterns: SimilarTaskPattern | undefined;
  if (boardId) {
    similarTaskPatterns = await findSimilarTasks(
      task.title,
      task.description,
      boardId,
      task.list_id,
      undefined,
      guidelines
    );
  }

  const userPrompt = buildDecomposePrompt(
    task,
    parentAssignees,
    similarTaskPatterns,
    workspaceMembers
  );
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPTS.taskDecomposer },
    { role: "user", content: userPrompt },
  ];

  const result = await chatCompletion(messages, { temperature: 0.5 });

  if (!result.success || !result.content) {
    return { success: false, error: result.error || "Failed to generate subtasks" };
  }

  const subtasks = parseJsonResponse<DecomposedSubtask[]>(result.content);

  if (!subtasks || !Array.isArray(subtasks)) {
    return { success: false, error: "Failed to parse AI response" };
  }

  // Validate subtasks, assignees, and distribute deadlines
  const validMemberIds = new Set(workspaceMembers.map((m) => m.id));
  const validSubtasks = subtasks
    .filter((s) => s.title && typeof s.title === "string")
    .map((s) => {
      const subtask: DecomposedSubtask = {
        title: s.title.trim(),
        due_date: s.due_date,
      };
      // Validate assignee_id exists in workspace
      if (s.assignee_id && validMemberIds.has(s.assignee_id)) {
        subtask.assignee_id = s.assignee_id;
      }
      return subtask;
    });

  if (validSubtasks.length === 0) {
    return { success: false, error: "No valid subtasks generated" };
  }

  // If parent has deadline, distribute subtask deadlines evenly before it
  if (task.due_date && validSubtasks.length > 0) {
    const parentDeadline = new Date(task.due_date);
    const today = new Date();
    const daysUntilDeadline = Math.ceil(
      (parentDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDeadline > 0) {
      // Distribute deadlines evenly across the time period
      for (let i = 0; i < validSubtasks.length; i++) {
        // If AI didn't suggest a deadline, calculate one
        if (!validSubtasks[i].due_date) {
          const progress = (i + 1) / validSubtasks.length;
          const daysOffset = Math.round(daysUntilDeadline * progress);
          const subtaskDeadline = new Date(today);
          subtaskDeadline.setDate(subtaskDeadline.getDate() + daysOffset);
          validSubtasks[i].due_date = subtaskDeadline.toISOString().split("T")[0];
        } else {
          // Validate AI-suggested deadline is before parent deadline
          const suggestedDeadline = new Date(validSubtasks[i].due_date);
          if (suggestedDeadline > parentDeadline) {
            // Use parent deadline instead
            validSubtasks[i].due_date = task.due_date;
          }
        }
      }
    }
  } else if (validSubtasks.length > 0) {
    // No parent deadline - suggest relative deadlines (1, 3, 5 days, etc.)
    for (let i = 0; i < validSubtasks.length; i++) {
      if (!validSubtasks[i].due_date) {
        const daysOffset = (i + 1) * 2; // 2, 4, 6, 8... days
        const subtaskDeadline = new Date();
        subtaskDeadline.setDate(subtaskDeadline.getDate() + daysOffset);
        validSubtasks[i].due_date = subtaskDeadline.toISOString().split("T")[0];
      }
    }
  }

  return { success: true, subtasks: validSubtasks };
}

/**
 * Summarize content (description or comments)
 */
export async function summarizeContent(
  content: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  if (!content || content.length < 100) {
    return { success: false, error: "Content too short to summarize" };
  }

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPTS.summarizer },
    { role: "user", content },
  ];

  const result = await chatCompletion(messages, {
    temperature: 0.3,
    maxTokens: 256,
  });

  if (!result.success || !result.content) {
    return { success: false, error: result.error || "Failed to generate summary" };
  }

  return { success: true, summary: result.content.trim() };
}

/**
 * Rewrite content to make it easier to understand
 */
export async function rewriteContent(
  content: string
): Promise<{ success: boolean; rewritten?: string; error?: string }> {
  if (!content || content.trim().length < 10) {
    return { success: false, error: "Content too short to rewrite" };
  }

  // Strip HTML tags for processing
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPTS.rewriter },
    { role: "user", content: plainText },
  ];

  const result = await chatCompletion(messages, {
    temperature: 0.5,
    maxTokens: 1024,
  });

  if (!result.success || !result.content) {
    return { success: false, error: result.error || "Failed to rewrite content" };
  }

  return { success: true, rewritten: result.content.trim() };
}

/**
 * Find similar tasks using hybrid matching (labels + list + keywords)
 * Returns aggregated patterns from similar tasks (0 AI tokens - pure SQL)
 * If guidelines are provided, uses them instead of querying the database
 */
async function findSimilarTasks(
  title: string,
  description: string | null,
  boardId: string,
  listId?: string,
  currentLabelIds?: string[],
  guidelines?: BoardGuidelines
): Promise<SimilarTaskPattern> {
  // If guidelines are provided, convert them to SimilarTaskPattern format
  if (guidelines) {
    // Extract top assignees by frequency
    const assigneeEntries = Object.entries(guidelines.assignee_rules || {})
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, 3)
      .map(([userId]) => userId);

    // Convert label priorities to common priorities frequency map
    // Since we don't have direct priority frequency, we'll create a simplified map
    // based on label priorities (if a label is associated with a priority, count it)
    const commonPriorities: Record<string, number> = {};
    if (guidelines.priority_rules?.label_priorities) {
      for (const [labelId, priority] of Object.entries(guidelines.priority_rules.label_priorities)) {
        if (priority && typeof priority === 'string') {
          commonPriorities[priority] = (commonPriorities[priority] || 0) + 1;
        }
      }
    }

    // Extract common labels (convert from IDs to names if needed, but for now use IDs)
    const commonLabels = (guidelines.label_rules?.common_labels || []).slice(0, 5);

    // Convert custom field rules to patterns format
    const customFieldPatterns: Record<string, { value: string; frequency: number }[]> = {};
    for (const [fieldId, rule] of Object.entries(guidelines.custom_field_rules || {})) {
      customFieldPatterns[fieldId] = (rule.common_values || []).map((value, idx) => ({
        value,
        frequency: Math.round((rule.frequencies?.[idx] || 0) * 100), // Convert to percentage
      }));
    }

    return {
      assignee_ids: assigneeEntries,
      avg_days_to_deadline: guidelines.deadline_rules?.avg_days_to_deadline 
        ? Math.round(guidelines.deadline_rules.avg_days_to_deadline)
        : null,
      common_priorities,
      common_labels,
      custom_field_patterns: customFieldPatterns,
      count: guidelines.metadata?.total_tasks_analyzed || 0,
    };
  }
  const supabase = await createClient();

  // Get all lists for this board
  const { data: lists } = await supabase
    .from("lists")
    .select("id")
    .eq("board_id", boardId);

  const listIds = lists?.map((l) => l.id) || [];

  if (listIds.length === 0) {
    return {
      assignee_ids: [],
      avg_days_to_deadline: null,
      common_priorities: {},
      common_labels: [],
      custom_field_patterns: {},
      count: 0,
    };
  }

  // Build query for similar tasks
  let query = supabase
    .from("tasks")
    .select(
      `
      id,
      title,
      priority,
      due_date,
      created_at,
      list_id,
      assignees:task_assignees(user_id),
      labels:task_labels(label_id, labels(name)),
      custom_field_values(field_id, value)
    `
    )
    .in("list_id", listIds)
    .eq("archived", false)
    .limit(50); // Get more tasks for better pattern matching

  // Boost relevance: same list if provided
  if (listId) {
    // We'll handle this in post-processing to prioritize same-list tasks
  }

  const { data: tasks, error } = await query;

  if (error || !tasks || tasks.length === 0) {
    return {
      assignee_ids: [],
      avg_days_to_deadline: null,
      common_priorities: {},
      common_labels: [],
      custom_field_patterns: {},
      count: 0,
    };
  }

  // Extract keywords from title for matching
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Score and filter similar tasks
  const scoredTasks = tasks
    .map((task) => {
      let score = 0;
      const taskTitleLower = (task.title || "").toLowerCase();

      // Same list boost
      if (listId && task.list_id === listId) {
        score += 10;
      }

      // Shared labels boost
      if (currentLabelIds && currentLabelIds.length > 0) {
        const taskLabelIds = (task.labels as Array<{ label_id: string }> | null)?.map(
          (l) => l.label_id
        ) || [];
        const sharedLabels = currentLabelIds.filter((id) => taskLabelIds.includes(id));
        score += sharedLabels.length * 5;
      }

      // Keyword matching
      const matchingWords = titleWords.filter((word) => taskTitleLower.includes(word));
      score += matchingWords.length * 2;

      return { task, score };
    })
    .filter((item) => item.score > 0) // Only include tasks with some similarity
    .sort((a, b) => b.score - a.score)
    .slice(0, 15) // Top 15 most similar
    .map((item) => item.task);

  if (scoredTasks.length === 0) {
    return {
      assignee_ids: [],
      avg_days_to_deadline: null,
      common_priorities: {},
      common_labels: [],
      custom_field_patterns: {},
      count: 0,
    };
  }

  // Aggregate patterns
  const assigneeCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  const labelCounts = new Map<string, number>();
  const customFieldCounts = new Map<string, Map<string, number>>();
  let totalDaysToDeadline = 0;
  let tasksWithDeadline = 0;
  const today = new Date();

  for (const task of scoredTasks) {
    // Count assignees
    const assignees = (task.assignees as Array<{ user_id: string }> | null) || [];
    for (const assignee of assignees) {
      const count = assigneeCounts.get(assignee.user_id) || 0;
      assigneeCounts.set(assignee.user_id, count + 1);
    }

    // Count priorities
    if (task.priority) {
      const count = priorityCounts.get(task.priority) || 0;
      priorityCounts.set(task.priority, count + 1);
    }

    // Count labels
    const labels = (task.labels as Array<{ labels: { name: string } } | null>) || [];
    for (const label of labels) {
      if (label.labels?.name) {
        const count = labelCounts.get(label.labels.name) || 0;
        labelCounts.set(label.labels.name, count + 1);
      }
    }

    // Calculate days to deadline
    if (task.due_date && task.created_at) {
      const createdDate = new Date(task.created_at);
      const dueDate = new Date(task.due_date);
      const daysDiff = Math.ceil(
        (dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 0 && daysDiff < 365) {
        // Reasonable range
        totalDaysToDeadline += daysDiff;
        tasksWithDeadline++;
      }
    }

    // Count custom field values
    const customFields = (task.custom_field_values as Array<{ field_id: string; value: string | null }> | null) || [];
    for (const cf of customFields) {
      if (cf.value) {
        if (!customFieldCounts.has(cf.field_id)) {
          customFieldCounts.set(cf.field_id, new Map());
        }
        const fieldMap = customFieldCounts.get(cf.field_id)!;
        const count = fieldMap.get(cf.value) || 0;
        fieldMap.set(cf.value, count + 1);
      }
    }
  }

  // Get top assignees (most frequent)
  const topAssignees = Array.from(assigneeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([userId]) => userId);

  // Get common priorities
  const commonPriorities: Record<string, number> = {};
  for (const [priority, count] of priorityCounts.entries()) {
    commonPriorities[priority] = count;
  }

  // Get common labels (appearing in at least 30% of tasks)
  const minLabelCount = Math.ceil(scoredTasks.length * 0.3);
  const commonLabels = Array.from(labelCounts.entries())
    .filter(([, count]) => count >= minLabelCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Get custom field patterns (top 2 values per field, appearing in at least 20% of tasks)
  const customFieldPatterns: Record<string, { value: string; frequency: number }[]> = {};
  const minCustomFieldCount = Math.ceil(scoredTasks.length * 0.2);

  for (const [fieldId, valueMap] of customFieldCounts.entries()) {
    const patterns = Array.from(valueMap.entries())
      .filter(([, count]) => count >= minCustomFieldCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([value, count]) => ({
        value,
        frequency: Math.round((count / scoredTasks.length) * 100),
      }));

    if (patterns.length > 0) {
      customFieldPatterns[fieldId] = patterns;
    }
  }

  return {
    assignee_ids: topAssignees,
    avg_days_to_deadline:
      tasksWithDeadline > 0 ? Math.round(totalDaysToDeadline / tasksWithDeadline) : null,
    common_priorities: commonPriorities,
    common_labels: commonLabels,
    custom_field_patterns: customFieldPatterns,
    count: scoredTasks.length,
  };
}

/**
 * Suggest labels and priority for a task
 */
export async function suggestTagsAndPriority(
  title: string,
  description: string | null,
  boardId: string,
  listId?: string,
  currentLabelIds?: string[]
): Promise<{ success: boolean; suggestion?: AutoTagSuggestion; error?: string }> {
  const supabase = await createClient();

  // Get available labels for the board
  const { data: labels } = await supabase
    .from("labels")
    .select("id, name")
    .eq("board_id", boardId);

  const availableLabels = labels?.map((l) => l.name) || [];
  const labelIdMap = new Map(labels?.map((l) => [l.name.toLowerCase(), l.id]) || []);

  // Get workspace members for assignee suggestions
  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  let workspaceMembers: Array<{ id: string; name: string }> = [];
  if (board?.workspace_id) {
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("workspace_id", board.workspace_id);

    if (members) {
      workspaceMembers = members.map((m) => {
        const profileData = m.profiles;
        const profile = Array.isArray(profileData) ? profileData[0] : profileData;
        return {
          id: m.user_id,
          name:
            (profile as { full_name?: string; email?: string })?.full_name ||
            (profile as { email?: string })?.email ||
            "Unknown",
        };
      });
    }
  }

  // Get custom fields for the board
  const { data: customFields } = await supabase
    .from("custom_fields")
    .select("id, name, field_type, options")
    .eq("board_id", boardId)
    .order("position");

  // Try to get guidelines first (fast path)
  const { getBoardGuidelines } = await import("./guidelines");
  const guidelinesResult = await getBoardGuidelines(boardId);
  const guidelines = guidelinesResult.success ? guidelinesResult.guidelines : undefined;

  // Find similar tasks and aggregate patterns (0 AI tokens - pure SQL)
  // Use guidelines if available, otherwise fallback to database query
  const patterns = await findSimilarTasks(title, description, boardId, listId, currentLabelIds, guidelines);

  // Build compact prompt with aggregated patterns
  const userPrompt = buildAutoTagPrompt(
    { title, description },
    availableLabels,
    patterns,
    workspaceMembers,
    customFields || []
  );

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPTS.autoTagger },
    { role: "user", content: userPrompt },
  ];

  const result = await chatCompletion(messages, { temperature: 0.3 });

  if (!result.success || !result.content) {
    return { success: false, error: result.error || "Failed to analyze task" };
  }

  const suggestion = parseJsonResponse<AutoTagSuggestion>(result.content);

  if (!suggestion) {
    return { success: false, error: "Failed to parse AI response" };
  }

  // Validate and filter labels to only include available ones
  const validLabels = (suggestion.labels || []).filter((l) =>
    availableLabels.some((al) => al.toLowerCase() === l.toLowerCase())
  );

  // Validate assignees exist in workspace
  const validAssignees = (suggestion.assignees || []).filter((userId) =>
    workspaceMembers.some((m) => m.id === userId)
  );

  // Validate custom field values
  const validCustomFields: Record<string, string> = {};
  if (suggestion.custom_fields && customFields) {
    for (const [fieldId, value] of Object.entries(suggestion.custom_fields)) {
      const field = customFields.find((f) => f.id === fieldId);
      if (field) {
        // Validate dropdown options
        if (field.field_type === "dropdown" && field.options) {
          if (field.options.includes(value)) {
            validCustomFields[fieldId] = value;
          }
        } else {
          // Text or number fields - accept any value
          validCustomFields[fieldId] = value;
        }
      }
    }
  }

  // Calculate suggested due date if pattern suggests one
  let suggestedDueDate: string | undefined;
  if (patterns.avg_days_to_deadline && patterns.avg_days_to_deadline > 0) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + patterns.avg_days_to_deadline);
    suggestedDueDate = dueDate.toISOString().split("T")[0];
  }

  // Use pattern-based priority if AI didn't suggest one
  let finalPriority = suggestion.priority || "medium";
  if (patterns.common_priorities && Object.keys(patterns.common_priorities).length > 0) {
    const topPriority = Object.entries(patterns.common_priorities).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
    if (!suggestion.priority) {
      finalPriority = topPriority as "low" | "medium" | "high" | "urgent";
    }
  }

  // Build reasoning
  let reasoning = suggestion.reasoning || "";
  if (patterns.count > 0) {
    reasoning = `Based on ${patterns.count} similar task${patterns.count !== 1 ? "s" : ""}. ${reasoning}`.trim();
  }

  return {
    success: true,
    suggestion: {
      priority: finalPriority,
      labels: validLabels,
      assignees: validAssignees.length > 0 ? validAssignees : undefined,
      due_date: suggestion.due_date || suggestedDueDate,
      custom_fields: Object.keys(validCustomFields).length > 0 ? validCustomFields : undefined,
      reasoning,
    },
  };
}

/**
 * Extract text from a PDF attachment (server action)
 */
export async function extractPdfContent(
  filePath: string
): Promise<{ success: boolean; text?: string; pageCount?: number; error?: string }> {
  try {
    // Import pdf-extractor dynamically to keep it server-only
    const { extractTextFromPDFUrl } = await import("@/lib/ai/pdf-extractor");
    const { getAttachmentUrl } = await import("@/lib/actions/attachments");

    // Get signed URL for the attachment
    const { url, error: urlError } = await getAttachmentUrl(filePath);

    if (urlError || !url) {
      return { success: false, error: urlError || "Could not get document URL" };
    }

    // Extract text from PDF
    const result = await extractTextFromPDFUrl(url);

    if (result.success && result.text) {
      return {
        success: true,
        text: result.text,
        pageCount: result.pageCount,
      };
    } else {
      return { success: false, error: result.error || "Failed to extract document content" };
    }
  } catch (err) {
    console.error("PDF extraction error:", err);
    return { success: false, error: "Failed to process PDF document" };
  }
}

/**
 * Chat with a document (PDF content)
 */
export async function chatWithDocument(
  documentContent: string,
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<{ success: boolean; response?: string; error?: string }> {
  if (!documentContent || documentContent.trim().length === 0) {
    return { success: false, error: "Document content is empty" };
  }

  // Truncate document if too long (roughly 50k characters to stay within context limits)
  const truncatedContent =
    documentContent.length > 50000
      ? documentContent.slice(0, 50000) + "\n\n[Document truncated due to length...]"
      : documentContent;

  const userPrompt = buildDocumentChatPrompt(truncatedContent, question);

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPTS.documentChat },
    // Add conversation history
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userPrompt },
  ];

  const result = await chatCompletion(messages, { temperature: 0.5 });

  if (!result.success || !result.content) {
    return { success: false, error: result.error || "Failed to process document" };
  }

  return { success: true, response: result.content };
}
