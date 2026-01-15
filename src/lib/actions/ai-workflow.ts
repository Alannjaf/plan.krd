"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";
import {
  analyzeWorkflow,
  suggestBoardStructure,
  analyzeProductivity,
  type WorkflowAnalysis,
  type BoardStructureSuggestion,
  type ProductivityAnalysis,
} from "@/lib/ai/workflow";

/**
 * Analyze workflow and store results
 */
export async function analyzeAndStoreWorkflow(
  boardId: string
): Promise<{ success: boolean; analysis?: WorkflowAnalysis; error?: string }> {
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

    // Analyze workflow
    const result = await analyzeWorkflow(boardId);

    if (!result.success || !result.analysis) {
      return result;
    }

    // Store analysis
    const { error: insertError } = await supabase.from("ai_workflow_analyses").insert({
      workspace_id: board.workspace_id,
      board_id: boardId,
      analysis_type: result.analysis.analysis_type,
      findings: result.analysis.findings,
      recommendations: result.analysis.recommendations,
    });

    if (insertError) {
      logger.error("Error storing workflow analysis", insertError);
      return { success: false, error: "Failed to store analysis" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true, analysis: result.analysis };
  } catch (error) {
    logger.error("Error analyzing workflow", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get stored workflow analyses for a board
 */
export async function getWorkflowAnalyses(
  boardId: string
): Promise<{ success: boolean; analyses?: WorkflowAnalysis[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: analyses, error } = await supabase
      .from("ai_workflow_analyses")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      logger.error("Error fetching workflow analyses", error);
      return { success: false, error: "Failed to fetch analyses" };
    }

    const formattedAnalyses: WorkflowAnalysis[] =
      analyses?.map((a) => ({
        analysis_type: a.analysis_type as any,
        findings: a.findings as any,
        recommendations: a.recommendations as any,
      })) || [];

    return { success: true, analyses: formattedAnalyses };
  } catch (error) {
    logger.error("Error getting workflow analyses", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get board structure suggestions
 */
export async function getBoardStructureSuggestions(
  boardId: string
): Promise<{ success: boolean; suggestion?: BoardStructureSuggestion; error?: string }> {
  try {
    const result = await suggestBoardStructure(boardId);
    return result;
  } catch (error) {
    logger.error("Error getting board structure suggestions", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Analyze productivity for a workspace
 */
export async function analyzeAndStoreProductivity(
  workspaceId: string,
  dateRange: { from: string; to: string }
): Promise<{ success: boolean; analysis?: ProductivityAnalysis; error?: string }> {
  const supabase = await createClient();

  try {
    // Analyze productivity
    const result = await analyzeProductivity(workspaceId, dateRange);

    if (!result.success || !result.analysis) {
      return result;
    }

    // Store analysis
    const { error: insertError } = await supabase.from("ai_workflow_analyses").insert({
      workspace_id: workspaceId,
      analysis_type: "productivity",
      findings: {
        metrics: result.analysis.metrics,
        patterns: result.analysis.patterns,
      },
      recommendations: result.analysis.recommendations,
    });

    if (insertError) {
      logger.error("Error storing productivity analysis", insertError);
      return { success: false, error: "Failed to store analysis" };
    }

    revalidatePath(`/[workspaceId]`, "layout");
    return { success: true, analysis: result.analysis };
  } catch (error) {
    logger.error("Error analyzing productivity", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get stored productivity analyses for a workspace
 */
export async function getProductivityAnalyses(
  workspaceId: string
): Promise<{ success: boolean; analyses?: ProductivityAnalysis[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: analyses, error } = await supabase
      .from("ai_workflow_analyses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("analysis_type", "productivity")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      logger.error("Error fetching productivity analyses", error);
      return { success: false, error: "Failed to fetch analyses" };
    }

    const formattedAnalyses: ProductivityAnalysis[] =
      analyses?.map((a) => ({
        period: (a.findings as any)?.period || { from: "", to: "" },
        metrics: (a.findings as any)?.metrics || {
          tasks_completed: 0,
          avg_completion_time: 0,
          completion_rate: 0,
          team_velocity: 0,
        },
        patterns: (a.findings as any)?.patterns || {
          peak_days: [],
          slow_periods: [],
          productivity_trends: "stable",
        },
        recommendations: a.recommendations as any || [],
      })) || [];

    return { success: true, analyses: formattedAnalyses };
  } catch (error) {
    logger.error("Error getting productivity analyses", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark a workflow analysis as applied
 */
export async function markAnalysisApplied(
  analysisId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("ai_workflow_analyses")
      .update({ applied_at: new Date().toISOString() })
      .eq("id", analysisId);

    if (error) {
      logger.error("Error marking analysis as applied", error);
      return { success: false, error: "Failed to update analysis" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true };
  } catch (error) {
    logger.error("Error marking analysis as applied", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
