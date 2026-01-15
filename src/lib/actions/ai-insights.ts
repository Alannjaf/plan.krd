"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";
import {
  generateAtRiskInsights,
  suggestDueDate,
  detectBottlenecks,
  predictWorkload,
  type AtRiskTask,
  type DueDateSuggestion,
  type Bottleneck,
  type WorkloadPrediction,
} from "@/lib/ai/insights";

/**
 * Generate and store at-risk task insights for a board
 */
export async function generateAndStoreAtRiskInsights(
  boardId: string
): Promise<{ success: boolean; insights?: AtRiskTask[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get board info for workspace_id
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id, workspace_id")
      .eq("id", boardId)
      .single();

    if (boardError || !board) {
      return { success: false, error: "Board not found" };
    }

    // Generate insights
    const result = await generateAtRiskInsights(boardId);

    if (!result.success || !result.insights) {
      return result;
    }

    // Store insights in database
    const insightsToStore = result.insights.map((insight) => ({
      workspace_id: board.workspace_id,
      board_id: boardId,
      task_id: insight.task_id,
      insight_type: "at_risk" as const,
      data: {
        task_title: insight.task_title,
        risk_factors: insight.risk_factors,
        suggested_action: insight.suggested_action,
      },
      confidence_score: insight.confidence,
    }));

    // Delete old at-risk insights for this board
    await supabase
      .from("ai_insights")
      .delete()
      .eq("board_id", boardId)
      .eq("insight_type", "at_risk")
      .is("dismissed_at", null);

    // Insert new insights
    const { error: insertError } = await supabase
      .from("ai_insights")
      .insert(insightsToStore);

    if (insertError) {
      logger.error("Error storing at-risk insights", insertError);
      return { success: false, error: "Failed to store insights" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true, insights: result.insights };
  } catch (error) {
    logger.error("Error generating at-risk insights", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get stored at-risk insights for a board
 */
export async function getAtRiskInsights(
  boardId: string
): Promise<{ success: boolean; insights?: AtRiskTask[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: insights, error } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("board_id", boardId)
      .eq("insight_type", "at_risk")
      .is("dismissed_at", null)
      .order("confidence_score", { ascending: false });

    if (error) {
      logger.error("Error fetching at-risk insights", error);
      return { success: false, error: "Failed to fetch insights" };
    }

    const formattedInsights: AtRiskTask[] =
      insights?.map((i) => ({
        task_id: i.task_id || "",
        task_title: (i.data as any)?.task_title || "",
        risk_factors: (i.data as any)?.risk_factors || [],
        confidence: i.confidence_score,
        suggested_action: (i.data as any)?.suggested_action,
      })) || [];

    return { success: true, insights: formattedInsights };
  } catch (error) {
    logger.error("Error getting at-risk insights", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Dismiss an insight
 */
export async function dismissInsight(
  insightId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("ai_insights")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", insightId);

    if (error) {
      logger.error("Error dismissing insight", error);
      return { success: false, error: "Failed to dismiss insight" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true };
  } catch (error) {
    logger.error("Error dismissing insight", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Suggest due date for a task and optionally store it
 */
export async function suggestAndStoreDueDate(
  taskId: string,
  store: boolean = true
): Promise<{ success: boolean; suggestion?: DueDateSuggestion; error?: string }> {
  const supabase = await createClient();

  try {
    // Get task details
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description, priority, list_id, lists!inner(board_id, boards(workspace_id))")
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

    // Generate suggestion
    const result = await suggestDueDate(taskId, {
      title: task.title,
      description: task.description || undefined,
      priority: task.priority || undefined,
    });

    if (!result.success || !result.suggestion) {
      return result;
    }

    // Store suggestion in task
    if (store) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          ai_suggested_due_date: result.suggestion.suggested_date,
          ai_confidence_score: result.suggestion.confidence,
        })
        .eq("id", taskId);

      if (updateError) {
        logger.error("Error storing due date suggestion", updateError);
      }

      // Also store as insight
      if (boardId && workspaceId) {
        await supabase.from("ai_insights").insert({
          workspace_id: workspaceId,
          board_id: boardId,
          task_id: taskId,
          insight_type: "due_date_suggestion",
          data: {
            suggested_date: result.suggestion.suggested_date,
            reasoning: result.suggestion.reasoning,
            based_on_patterns: result.suggestion.based_on_patterns,
          },
          confidence_score: result.suggestion.confidence,
        });
      }

      revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    }

    return { success: true, suggestion: result.suggestion };
  } catch (error) {
    logger.error("Error suggesting due date", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Detect and store bottlenecks for a board
 */
export async function detectAndStoreBottlenecks(
  boardId: string
): Promise<{ success: boolean; bottlenecks?: Bottleneck[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get board info
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id, workspace_id")
      .eq("id", boardId)
      .single();

    if (boardError || !board) {
      return { success: false, error: "Board not found" };
    }

    // Detect bottlenecks
    const result = await detectBottlenecks(boardId);

    if (!result.success || !result.bottlenecks) {
      return result;
    }

    // Store bottlenecks
    const bottlenecksToStore = result.bottlenecks.map((b) => ({
      workspace_id: board.workspace_id,
      board_id: boardId,
      insight_type: "bottleneck" as const,
      data: {
        list_id: b.list_id,
        list_name: b.list_name,
        task_count: b.task_count,
        avg_days_in_list: b.avg_days_in_list,
        risk_level: b.risk_level,
        recommendations: b.recommendations,
      },
      confidence_score: b.risk_level === "high" ? 0.9 : b.risk_level === "medium" ? 0.7 : 0.5,
    }));

    // Delete old bottleneck insights
    await supabase
      .from("ai_insights")
      .delete()
      .eq("board_id", boardId)
      .eq("insight_type", "bottleneck")
      .is("dismissed_at", null);

    // Insert new insights
    const { error: insertError } = await supabase
      .from("ai_insights")
      .insert(bottlenecksToStore);

    if (insertError) {
      logger.error("Error storing bottlenecks", insertError);
      return { success: false, error: "Failed to store bottlenecks" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true, bottlenecks: result.bottlenecks };
  } catch (error) {
    logger.error("Error detecting bottlenecks", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get stored bottlenecks for a board
 */
export async function getBottlenecks(
  boardId: string
): Promise<{ success: boolean; bottlenecks?: Bottleneck[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: insights, error } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("board_id", boardId)
      .eq("insight_type", "bottleneck")
      .is("dismissed_at", null)
      .order("confidence_score", { ascending: false });

    if (error) {
      logger.error("Error fetching bottlenecks", error);
      return { success: false, error: "Failed to fetch bottlenecks" };
    }

    const bottlenecks: Bottleneck[] =
      insights?.map((i) => ({
        list_id: (i.data as any)?.list_id || "",
        list_name: (i.data as any)?.list_name || "",
        task_count: (i.data as any)?.task_count || 0,
        avg_days_in_list: (i.data as any)?.avg_days_in_list || 0,
        risk_level: (i.data as any)?.risk_level || "low",
        recommendations: (i.data as any)?.recommendations || [],
      })) || [];

    return { success: true, bottlenecks };
  } catch (error) {
    logger.error("Error getting bottlenecks", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Predict and store workload for a workspace
 */
export async function predictAndStoreWorkload(
  workspaceId: string,
  dateRange?: { from: string; to: string }
): Promise<{ success: boolean; predictions?: WorkloadPrediction[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Predict workload
    const result = await predictWorkload(workspaceId, dateRange);

    if (!result.success || !result.predictions) {
      return result;
    }

    // Store workload insights
    const insightsToStore = result.predictions
      .filter((p) => p.risk_level !== "low")
      .map((p) => ({
        workspace_id: workspaceId,
        insight_type: "workload" as const,
        data: {
          user_id: p.user_id,
          user_name: p.user_name,
          current_tasks: p.current_tasks,
          predicted_tasks: p.predicted_tasks,
          capacity_utilization: p.capacity_utilization,
          risk_level: p.risk_level,
          recommendations: p.recommendations,
        },
        confidence_score: p.risk_level === "overloaded" ? 0.95 : p.risk_level === "high" ? 0.8 : 0.6,
      }));

    if (insightsToStore.length > 0) {
      // Delete old workload insights
      await supabase
        .from("ai_insights")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("insight_type", "workload")
        .is("dismissed_at", null);

      // Insert new insights
      const { error: insertError } = await supabase
        .from("ai_insights")
        .insert(insightsToStore);

      if (insertError) {
        logger.error("Error storing workload predictions", insertError);
      }
    }

    revalidatePath(`/[workspaceId]`, "layout");
    return { success: true, predictions: result.predictions };
  } catch (error) {
    logger.error("Error predicting workload", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get stored workload predictions for a workspace
 */
export async function getWorkloadPredictions(
  workspaceId: string
): Promise<{ success: boolean; predictions?: WorkloadPrediction[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: insights, error } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("insight_type", "workload")
      .is("dismissed_at", null)
      .order("confidence_score", { ascending: false });

    if (error) {
      logger.error("Error fetching workload predictions", error);
      return { success: false, error: "Failed to fetch predictions" };
    }

    const predictions: WorkloadPrediction[] =
      insights?.map((i) => ({
        user_id: (i.data as any)?.user_id || "",
        user_name: (i.data as any)?.user_name || "",
        current_tasks: (i.data as any)?.current_tasks || 0,
        predicted_tasks: (i.data as any)?.predicted_tasks || 0,
        capacity_utilization: (i.data as any)?.capacity_utilization || 0,
        risk_level: (i.data as any)?.risk_level || "low",
        recommendations: (i.data as any)?.recommendations || [],
      })) || [];

    return { success: true, predictions };
  } catch (error) {
    logger.error("Error getting workload predictions", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
