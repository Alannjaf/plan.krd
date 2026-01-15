/**
 * AI-Powered Insights Core Logic
 * Provides predictive analytics and intelligent recommendations
 */

import { createClient } from "@/lib/supabase/server";
import { chatCompletion, parseJsonResponse, type Message } from "@/lib/ai/openrouter";
import { logger } from "@/lib/utils/logger";

export type AtRiskTask = {
  task_id: string;
  task_title: string;
  risk_factors: string[];
  confidence: number;
  suggested_action?: string;
};

export type DueDateSuggestion = {
  suggested_date: string; // YYYY-MM-DD
  confidence: number;
  reasoning: string;
  based_on_patterns: boolean;
};

export type Bottleneck = {
  list_id: string;
  list_name: string;
  task_count: number;
  avg_days_in_list: number;
  risk_level: "low" | "medium" | "high";
  recommendations: string[];
};

export type WorkloadPrediction = {
  user_id: string;
  user_name: string;
  current_tasks: number;
  predicted_tasks: number;
  capacity_utilization: number; // 0.0 to 1.0
  risk_level: "low" | "medium" | "high" | "overloaded";
  recommendations: string[];
};

/**
 * Analyze tasks to identify at-risk tasks (likely to miss deadlines)
 */
export async function generateAtRiskInsights(
  boardId: string
): Promise<{ success: boolean; insights?: AtRiskTask[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get all tasks in the board with their details
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        created_at,
        completed,
        lists!inner(id, name, board_id),
        task_assignees(user_id, profiles(full_name, email))
      `)
      .eq("lists.board_id", boardId)
      .eq("archived", false)
      .eq("completed", false);

    if (tasksError) {
      logger.error("Error fetching tasks for at-risk analysis", tasksError);
      return { success: false, error: "Failed to fetch tasks" };
    }

    if (!tasks || tasks.length === 0) {
      return { success: true, insights: [] };
    }

    // Get historical completion data for similar tasks
    const { data: completedTasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, completed_at, created_at, priority")
      .eq("lists.board_id", boardId)
      .eq("completed", true)
      .not("completed_at", "is", null)
      .not("due_date", "is", null)
      .limit(100);

    // Build context for AI analysis
    const today = new Date();
    const tasksContext = tasks.map((task) => {
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const daysUntilDue = dueDate
        ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const daysSinceCreated = Math.ceil(
        (today.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const assignees = Array.isArray(task.task_assignees)
        ? task.task_assignees.map((ta: any) => {
            const profile = Array.isArray(ta.profiles) ? ta.profiles[0] : ta.profiles;
            return profile?.full_name || profile?.email || "Unknown";
          })
        : [];

      // Handle lists type
      const listsData = task.lists as unknown;
      let listName = "Unknown";
      if (listsData) {
        if (Array.isArray(listsData)) {
          const firstList = listsData[0] as { name?: string } | undefined;
          listName = firstList?.name || "Unknown";
        } else if (typeof listsData === 'object') {
          const listObj = listsData as { name?: string };
          listName = listObj.name || "Unknown";
        }
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description || "",
        due_date: task.due_date,
        days_until_due: daysUntilDue,
        days_since_created: daysSinceCreated,
        priority: task.priority || "medium",
        assignees,
        list_name: listName,
      };
    });

    const historicalData = completedTasks
      ? completedTasks.map((t) => ({
          title: t.title,
          days_to_complete: t.completed_at && t.created_at
            ? Math.ceil(
                (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
          priority: t.priority || "medium",
        }))
      : [];

    // Build AI prompt
    const prompt = `Analyze the following tasks and identify which ones are at risk of missing their deadlines.

Current date: ${today.toISOString().split("T")[0]}

Tasks to analyze:
${JSON.stringify(tasksContext, null, 2)}

Historical completion data (for reference):
${JSON.stringify(historicalData.slice(0, 20), null, 2)}

For each at-risk task, identify:
1. Risk factors (e.g., "due in 2 days but not started", "high priority but no assignee", "similar tasks took 5 days on average")
2. Confidence score (0.0 to 1.0)
3. Suggested action (optional)

Return a JSON array of at-risk tasks:
[
  {
    "task_id": "task-id",
    "task_title": "Task title",
    "risk_factors": ["factor1", "factor2"],
    "confidence": 0.85,
    "suggested_action": "Assign to available team member"
  }
]

Only include tasks with confidence >= 0.6.`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are an expert project manager analyzing task risks. Identify tasks that are likely to miss deadlines based on:
- Time remaining vs. time needed (based on historical data)
- Task complexity and priority
- Current progress (no assignee, not started, etc.)
- Similar task completion patterns`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.3 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to generate insights" };
    }

    const insights = parseJsonResponse<AtRiskTask[]>(result.content);

    if (!insights || !Array.isArray(insights)) {
      return { success: false, error: "Failed to parse AI response" };
    }

    // Filter and validate insights
    const validInsights = insights.filter(
      (i) =>
        i.task_id &&
        i.task_title &&
        Array.isArray(i.risk_factors) &&
        typeof i.confidence === "number" &&
        i.confidence >= 0.6
    );

    return { success: true, insights: validInsights };
  } catch (error) {
    logger.error("Error generating at-risk insights", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Suggest optimal due date for a task based on historical data
 */
export async function suggestDueDate(
  taskId: string,
  context?: {
    title?: string;
    description?: string;
    priority?: string;
    assignee_ids?: string[];
  }
): Promise<{ success: boolean; suggestion?: DueDateSuggestion; error?: string }> {
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
        lists!inner(board_id)
      `)
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: "Task not found" };
    }

    // Handle nested query result types
    const listsData = task.lists as unknown;
    let boardId: string | undefined;

    if (listsData) {
      if (Array.isArray(listsData)) {
        const firstList = listsData[0] as { board_id?: string } | undefined;
        boardId = firstList?.board_id;
      } else if (typeof listsData === 'object') {
        const listObj = listsData as { board_id?: string };
        boardId = listObj.board_id;
      }
    }

    if (!boardId) {
      return { success: false, error: "Board not found" };
    }

    // Get similar completed tasks for pattern analysis
    const { data: similarTasks } = await supabase
      .from("tasks")
      .select("title, created_at, completed_at, priority")
      .eq("lists.board_id", boardId)
      .eq("completed", true)
      .not("completed_at", "is", null)
      .limit(50);

    // Calculate average completion time
    let avgDaysToComplete: number | null = null;
    if (similarTasks && similarTasks.length > 0) {
      const completionTimes = similarTasks
        .map((t) => {
          if (!t.completed_at || !t.created_at) return null;
          return Math.ceil(
            (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
        })
        .filter((t): t is number => t !== null);

      if (completionTimes.length > 0) {
        avgDaysToComplete =
          completionTimes.reduce((sum, days) => sum + days, 0) / completionTimes.length;
      }
    }

    // Build AI prompt
    const today = new Date();
    const prompt = `Suggest an optimal due date for this task:

Task title: ${context?.title || task.title}
Task description: ${context?.description || task.description || "None"}
Priority: ${context?.priority || task.priority || "medium"}

Historical data:
- Average completion time for similar tasks: ${avgDaysToComplete ? `${avgDaysToComplete.toFixed(1)} days` : "No data available"}
- Today's date: ${today.toISOString().split("T")[0]}

Consider:
- Task complexity (from title/description)
- Priority level
- Historical completion patterns
- Standard work week (5 days)

Return JSON:
{
  "suggested_date": "YYYY-MM-DD",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "based_on_patterns": true/false
}`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a project planning expert. Suggest realistic due dates based on task complexity, priority, and historical patterns.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.4 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to generate suggestion" };
    }

    const suggestion = parseJsonResponse<DueDateSuggestion>(result.content);

    if (!suggestion || !suggestion.suggested_date) {
      return { success: false, error: "Failed to parse AI response" };
    }

    // Validate date format
    const suggestedDate = new Date(suggestion.suggested_date);
    if (isNaN(suggestedDate.getTime())) {
      return { success: false, error: "Invalid date format" };
    }

    return { success: true, suggestion };
  } catch (error) {
    logger.error("Error suggesting due date", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Detect workflow bottlenecks in a board
 */
export async function detectBottlenecks(
  boardId: string
): Promise<{ success: boolean; bottlenecks?: Bottleneck[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get all lists in the board
    const { data: lists, error: listsError } = await supabase
      .from("lists")
      .select("id, name, position")
      .eq("board_id", boardId)
      .order("position", { ascending: true });

    if (listsError || !lists) {
      return { success: false, error: "Failed to fetch lists" };
    }

    // Get task flow data
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, list_id, created_at, completed_at, lists!inner(id, name)")
      .eq("lists.board_id", boardId)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(200);

    // Calculate metrics for each list
    const listMetrics = lists.map((list) => {
      const listTasks = tasks?.filter((t) => {
        const taskList = Array.isArray(t.lists) ? t.lists[0] : t.lists;
        return taskList?.id === list.id;
      }) || [];

      // Calculate average days in this list
      const tasksWithDates = listTasks.filter((t) => t.created_at);
      let avgDays = 0;
      if (tasksWithDates.length > 0) {
        const today = new Date();
        const totalDays = tasksWithDates.reduce((sum, t) => {
          const created = new Date(t.created_at);
          return sum + Math.ceil((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        avgDays = totalDays / tasksWithDates.length;
      }

      return {
        list_id: list.id,
        list_name: list.name,
        task_count: listTasks.length,
        avg_days_in_list: avgDays,
      };
    });

    // Build AI prompt
    const prompt = `Analyze the workflow for bottlenecks:

Lists and their metrics:
${JSON.stringify(listMetrics, null, 2)}

Identify bottlenecks based on:
- High task count in a list (indicates tasks getting stuck)
- High average days in list (indicates slow movement)
- Position in workflow (middle lists often have bottlenecks)

Return JSON array:
[
  {
    "list_id": "list-id",
    "list_name": "List name",
    "task_count": 10,
    "avg_days_in_list": 5.2,
    "risk_level": "high" | "medium" | "low",
    "recommendations": ["recommendation1", "recommendation2"]
  }
]

Only include lists with risk_level "medium" or "high".`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a workflow optimization expert. Identify bottlenecks where tasks get stuck or move slowly.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.3 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to detect bottlenecks" };
    }

    const bottlenecks = parseJsonResponse<Bottleneck[]>(result.content);

    if (!bottlenecks || !Array.isArray(bottlenecks)) {
      return { success: false, error: "Failed to parse AI response" };
    }

    return { success: true, bottlenecks };
  } catch (error) {
    logger.error("Error detecting bottlenecks", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Predict team workload and capacity
 */
export async function predictWorkload(
  workspaceId: string,
  dateRange?: { from: string; to: string }
): Promise<{ success: boolean; predictions?: WorkloadPrediction[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get workspace members
    const { data: members, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("workspace_id", workspaceId);

    if (membersError || !members) {
      return { success: false, error: "Failed to fetch workspace members" };
    }

    const today = new Date();
    const fromDate = dateRange?.from || today.toISOString().split("T")[0];
    const toDate = dateRange?.to || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Get current and upcoming tasks for each member
    const predictions: WorkloadPrediction[] = [];

    for (const member of members) {
      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
      const userName = profile?.full_name || profile?.email || "Unknown";

      // Get current active tasks
      const { data: currentTasks } = await supabase
        .from("task_assignees")
        .select("task_id, tasks!inner(id, due_date, completed, priority)")
        .eq("user_id", member.user_id)
        .eq("tasks.completed", false)
        .eq("tasks.archived", false);

      const currentTaskCount = currentTasks?.length || 0;

      // Get tasks due in the date range
      const { data: upcomingTasks } = await supabase
        .from("task_assignees")
        .select("task_id, tasks!inner(id, due_date, priority)")
        .eq("user_id", member.user_id)
        .gte("tasks.due_date", fromDate)
        .lte("tasks.due_date", toDate)
        .eq("tasks.archived", false);

      const upcomingTaskCount = upcomingTasks?.length || 0;
      const predictedTasks = currentTaskCount + upcomingTaskCount;

      // Estimate capacity (assume 5-10 tasks per person is normal capacity)
      const estimatedCapacity = 8;
      const capacityUtilization = predictedTasks / estimatedCapacity;

      let riskLevel: "low" | "medium" | "high" | "overloaded";
      if (capacityUtilization >= 1.5) {
        riskLevel = "overloaded";
      } else if (capacityUtilization >= 1.2) {
        riskLevel = "high";
      } else if (capacityUtilization >= 0.8) {
        riskLevel = "medium";
      } else {
        riskLevel = "low";
      }

      const recommendations: string[] = [];
      if (riskLevel === "overloaded") {
        recommendations.push("Consider redistributing tasks to other team members");
        recommendations.push("Review task priorities and defer non-urgent items");
      } else if (riskLevel === "high") {
        recommendations.push("Monitor workload closely");
        recommendations.push("Consider task prioritization");
      }

      predictions.push({
        user_id: member.user_id,
        user_name: userName,
        current_tasks: currentTaskCount,
        predicted_tasks: predictedTasks,
        capacity_utilization: Math.min(capacityUtilization, 2.0), // Cap at 200%
        risk_level: riskLevel,
        recommendations,
      });
    }

    return { success: true, predictions };
  } catch (error) {
    logger.error("Error predicting workload", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
