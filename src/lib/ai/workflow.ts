/**
 * AI Workflow Optimization Core Logic
 * Analyzes and suggests workflow improvements
 */

import { createClient } from "@/lib/supabase/server";
import { chatCompletion, parseJsonResponse, type Message } from "@/lib/ai/openrouter";
import { logger } from "@/lib/utils/logger";

export type WorkflowAnalysis = {
  analysis_type: "bottleneck" | "structure" | "productivity";
  findings: {
    issues: Array<{
      type: string;
      severity: "low" | "medium" | "high";
      description: string;
      impact: string;
    }>;
    metrics: {
      avg_cycle_time: number;
      completion_rate: number;
      task_velocity: number;
    };
  };
  recommendations: Array<{
    priority: "low" | "medium" | "high";
    recommendation: string;
    expected_impact: string;
    implementation_effort: "low" | "medium" | "high";
  }>;
};

export type BoardStructureSuggestion = {
  current_structure: Array<{
    list_id: string;
    list_name: string;
    task_count: number;
    avg_days: number;
  }>;
  suggested_structure: Array<{
    action: "add" | "remove" | "merge" | "reorder";
    list_name: string;
    reasoning: string;
  }>;
  expected_benefits: string[];
};

export type ProductivityAnalysis = {
  period: {
    from: string;
    to: string;
  };
  metrics: {
    tasks_completed: number;
    avg_completion_time: number;
    completion_rate: number;
    team_velocity: number;
  };
  patterns: {
    peak_days: string[];
    slow_periods: string[];
    productivity_trends: "increasing" | "decreasing" | "stable";
  };
  recommendations: string[];
};

/**
 * Comprehensive workflow analysis for a board
 */
export async function analyzeWorkflow(
  boardId: string
): Promise<{ success: boolean; analysis?: WorkflowAnalysis; error?: string }> {
  const supabase = await createClient();

  try {
    // Get board structure
    const { data: lists, error: listsError } = await supabase
      .from("lists")
      .select("id, name, position")
      .eq("board_id", boardId)
      .order("position", { ascending: true });

    if (listsError || !lists) {
      return { success: false, error: "Failed to fetch board structure" };
    }

    // Get task flow data
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        list_id,
        created_at,
        completed_at,
        due_date,
        priority,
        completed,
        lists!inner(id, name)
      `)
      .eq("lists.board_id", boardId)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(500);

    if (tasksError) {
      return { success: false, error: "Failed to fetch tasks" };
    }

    // Calculate metrics
    const completedTasks = tasks?.filter((t) => t.completed && t.completed_at) || [];
    const totalTasks = tasks?.length || 0;
    const completionRate = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

    // Calculate average cycle time
    let avgCycleTime = 0;
    if (completedTasks.length > 0) {
      const cycleTimes = completedTasks
        .map((t) => {
          if (!t.created_at || !t.completed_at) return null;
          return Math.ceil(
            (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
        })
        .filter((t): t is number => t !== null);

      if (cycleTimes.length > 0) {
        avgCycleTime = cycleTimes.reduce((sum, days) => sum + days, 0) / cycleTimes.length;
      }
    }

    // Calculate task velocity (tasks completed per week)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentCompleted = completedTasks.filter((t) => {
      if (!t.completed_at) return false;
      return new Date(t.completed_at) >= oneWeekAgo;
    });
    const taskVelocity = recentCompleted.length;

    // Analyze list metrics
    const listMetrics = lists.map((list) => {
      const listTasks = tasks?.filter((t) => {
        const taskList = Array.isArray(t.lists) ? t.lists[0] : t.lists;
        return taskList?.id === list.id;
      }) || [];

      const tasksWithDates = listTasks.filter((t) => t.created_at);
      let avgDays = 0;
      if (tasksWithDates.length > 0) {
        const totalDays = tasksWithDates.reduce((sum, t) => {
          const created = new Date(t.created_at);
          return sum + Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        avgDays = totalDays / tasksWithDates.length;
      }

      return {
        list_id: list.id,
        list_name: list.name,
        task_count: listTasks.length,
        avg_days: avgDays,
      };
    });

    // Build AI prompt
    const prompt = `Analyze this workflow and provide comprehensive insights:

Board Structure:
${JSON.stringify(listMetrics, null, 2)}

Metrics:
- Total tasks: ${totalTasks}
- Completed tasks: ${completedTasks.length}
- Completion rate: ${(completionRate * 100).toFixed(1)}%
- Average cycle time: ${avgCycleTime.toFixed(1)} days
- Task velocity (last week): ${taskVelocity} tasks

Identify:
1. Issues and bottlenecks
2. Workflow inefficiencies
3. Areas for improvement

Return JSON:
{
  "analysis_type": "bottleneck" | "structure" | "productivity",
  "findings": {
    "issues": [
      {
        "type": "bottleneck" | "inefficiency" | "structure",
        "severity": "low" | "medium" | "high",
        "description": "Issue description",
        "impact": "Impact description"
      }
    ],
    "metrics": {
      "avg_cycle_time": ${avgCycleTime},
      "completion_rate": ${completionRate},
      "task_velocity": ${taskVelocity}
    }
  },
  "recommendations": [
    {
      "priority": "low" | "medium" | "high",
      "recommendation": "Specific recommendation",
      "expected_impact": "Expected improvement",
      "implementation_effort": "low" | "medium" | "high"
    }
  ]
}`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a workflow optimization expert. Analyze workflows and provide actionable recommendations to improve efficiency and productivity.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.3 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to analyze workflow" };
    }

    const analysis = parseJsonResponse<WorkflowAnalysis>(result.content);

    if (!analysis || !analysis.findings || !analysis.recommendations) {
      return { success: false, error: "Failed to parse AI response" };
    }

    // Ensure metrics are included
    analysis.findings.metrics = {
      avg_cycle_time: avgCycleTime,
      completion_rate: completionRate,
      task_velocity: taskVelocity,
    };

    return { success: true, analysis };
  } catch (error) {
    logger.error("Error analyzing workflow", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Suggest board structure improvements
 */
export async function suggestBoardStructure(
  boardId: string
): Promise<{ success: boolean; suggestion?: BoardStructureSuggestion; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current board structure
    const { data: lists, error: listsError } = await supabase
      .from("lists")
      .select("id, name, position")
      .eq("board_id", boardId)
      .order("position", { ascending: true });

    if (listsError || !lists) {
      return { success: false, error: "Failed to fetch board structure" };
    }

    // Get task distribution
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, list_id, created_at, lists!inner(id, name)")
      .eq("lists.board_id", boardId)
      .eq("archived", false)
      .limit(500);

    const now = new Date();
    const currentStructure = lists.map((list) => {
      const listTasks = tasks?.filter((t) => {
        const taskList = Array.isArray(t.lists) ? t.lists[0] : t.lists;
        return taskList?.id === list.id;
      }) || [];

      const tasksWithDates = listTasks.filter((t) => t.created_at);
      let avgDays = 0;
      if (tasksWithDates.length > 0) {
        const totalDays = tasksWithDates.reduce((sum, t) => {
          const created = new Date(t.created_at);
          return sum + Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        avgDays = totalDays / tasksWithDates.length;
      }

      return {
        list_id: list.id,
        list_name: list.name,
        task_count: listTasks.length,
        avg_days: avgDays,
      };
    });

    // Build AI prompt
    const prompt = `Analyze this board structure and suggest improvements:

Current Structure:
${JSON.stringify(currentStructure, null, 2)}

Consider:
- Task distribution (are tasks stuck in certain lists?)
- List naming and purpose clarity
- Missing workflow stages
- Unnecessary lists
- Optimal list order

Return JSON:
{
  "current_structure": ${JSON.stringify(currentStructure)},
  "suggested_structure": [
    {
      "action": "add" | "remove" | "merge" | "reorder",
      "list_name": "List name",
      "reasoning": "Why this change"
    }
  ],
  "expected_benefits": ["benefit1", "benefit2"]
}`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a board structure optimization expert. Suggest improvements to board layouts for better workflow efficiency.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.3 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to suggest structure" };
    }

    const suggestion = parseJsonResponse<BoardStructureSuggestion>(result.content);

    if (!suggestion || !suggestion.suggested_structure) {
      return { success: false, error: "Failed to parse AI response" };
    }

    // Ensure current structure is included
    suggestion.current_structure = currentStructure;

    return { success: true, suggestion };
  } catch (error) {
    logger.error("Error suggesting board structure", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Analyze productivity patterns
 */
export async function analyzeProductivity(
  workspaceId: string,
  dateRange: { from: string; to: string }
): Promise<{ success: boolean; analysis?: ProductivityAnalysis; error?: string }> {
  const supabase = await createClient();

  try {
    // Get all boards in workspace
    const { data: boards } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (!boards || boards.length === 0) {
      return { success: false, error: "No boards found in workspace" };
    }

    const boardIds = boards.map((b) => b.id);

    // Get completed tasks in date range
    const { data: completedTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, created_at, completed_at, lists!inner(board_id)")
      .in("lists.board_id", boardIds)
      .eq("completed", true)
      .not("completed_at", "is", null)
      .gte("completed_at", dateRange.from)
      .lte("completed_at", dateRange.to)
      .eq("archived", false);

    if (tasksError) {
      return { success: false, error: "Failed to fetch tasks" };
    }

    const tasks = completedTasks || [];
    const tasksCompleted = tasks.length;

    // Calculate average completion time
    let avgCompletionTime = 0;
    if (tasks.length > 0) {
      const completionTimes = tasks
        .map((t) => {
          if (!t.created_at || !t.completed_at) return null;
          return Math.ceil(
            (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
        })
        .filter((t): t is number => t !== null);

      if (completionTimes.length > 0) {
        avgCompletionTime =
          completionTimes.reduce((sum, days) => sum + days, 0) / completionTimes.length;
      }
    }

    // Calculate completion rate (completed vs created in period)
    const { data: createdTasks } = await supabase
      .from("tasks")
      .select("id")
      .in("lists.board_id", boardIds)
      .gte("created_at", dateRange.from)
      .lte("created_at", dateRange.to)
      .eq("archived", false);

    const totalCreated = createdTasks?.length || 0;
    const completionRate = totalCreated > 0 ? tasksCompleted / totalCreated : 0;

    // Calculate team velocity (tasks per week)
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeks = Math.max(1, daysDiff / 7);
    const teamVelocity = tasksCompleted / weeks;

    // Analyze day patterns
    const dayCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.completed_at) {
        const day = new Date(t.completed_at).toLocaleDateString("en-US", { weekday: "long" });
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    });

    const peakDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => day);

    // Build AI prompt
    const prompt = `Analyze productivity patterns:

Period: ${dateRange.from} to ${dateRange.to}

Metrics:
- Tasks completed: ${tasksCompleted}
- Average completion time: ${avgCompletionTime.toFixed(1)} days
- Completion rate: ${(completionRate * 100).toFixed(1)}%
- Team velocity: ${teamVelocity.toFixed(1)} tasks/week
- Peak days: ${peakDays.join(", ")}

Provide analysis and recommendations.

Return JSON:
{
  "period": {
    "from": "${dateRange.from}",
    "to": "${dateRange.to}"
  },
  "metrics": {
    "tasks_completed": ${tasksCompleted},
    "avg_completion_time": ${avgCompletionTime},
    "completion_rate": ${completionRate},
    "team_velocity": ${teamVelocity}
  },
  "patterns": {
    "peak_days": ${JSON.stringify(peakDays)},
    "slow_periods": [],
    "productivity_trends": "increasing" | "decreasing" | "stable"
  },
  "recommendations": ["recommendation1", "recommendation2"]
}`;

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a productivity analysis expert. Analyze team productivity patterns and provide actionable recommendations.`,
      },
      { role: "user", content: prompt },
    ];

    const result = await chatCompletion(messages, { temperature: 0.3 });

    if (!result.success || !result.content) {
      return { success: false, error: result.error || "Failed to analyze productivity" };
    }

    const analysis = parseJsonResponse<ProductivityAnalysis>(result.content);

    if (!analysis || !analysis.metrics) {
      return { success: false, error: "Failed to parse AI response" };
    }

    // Ensure metrics are accurate
    analysis.metrics = {
      tasks_completed: tasksCompleted,
      avg_completion_time: avgCompletionTime,
      completion_rate: completionRate,
      team_velocity: teamVelocity,
    };

    analysis.patterns.peak_days = peakDays;

    return { success: true, analysis };
  } catch (error) {
    logger.error("Error analyzing productivity", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
