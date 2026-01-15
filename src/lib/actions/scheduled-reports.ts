"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";
import type { ReportFilters, ReportFieldSelection } from "./reports";

export type ScheduledReportSchedule = {
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  time?: string; // HH:MM format
};

export type ScheduledReport = {
  id: string;
  workspace_id: string;
  board_id: string | null;
  name: string;
  report_config: {
    filters?: ReportFilters;
    fields?: ReportFieldSelection;
  };
  schedule: ScheduledReportSchedule;
  recipients: string[];
  enabled: boolean;
  last_run_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/**
 * Get all scheduled reports for a workspace
 */
export async function getScheduledReports(
  workspaceId: string
): Promise<{ success: boolean; data?: ScheduledReport[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { data, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching scheduled reports", error, { workspaceId });
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    logger.error("Error fetching scheduled reports", error, { workspaceId });
    return { success: false, error: "Failed to fetch scheduled reports" };
  }
}

/**
 * Create a new scheduled report
 */
export async function createScheduledReport(params: {
  workspaceId: string;
  boardId?: string;
  name: string;
  reportConfig: {
    filters?: ReportFilters;
    fields?: ReportFieldSelection;
  };
  schedule: ScheduledReportSchedule;
  recipients: string[];
}): Promise<{ success: boolean; data?: ScheduledReport; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId, name, reportConfig, schedule, recipients } = params;

  try {
    const { data, error } = await supabase
      .from("scheduled_reports")
      .insert({
        workspace_id: workspaceId,
        board_id: boardId || null,
        name,
        report_config: reportConfig,
        schedule,
        recipients,
        enabled: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating scheduled report", error, params);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    logger.error("Error creating scheduled report", error, params);
    return { success: false, error: "Failed to create scheduled report" };
  }
}

/**
 * Update a scheduled report
 */
export async function updateScheduledReport(
  reportId: string,
  updates: {
    name?: string;
    reportConfig?: {
      filters?: ReportFilters;
      fields?: ReportFieldSelection;
    };
    schedule?: ScheduledReportSchedule;
    recipients?: string[];
    enabled?: boolean;
  }
): Promise<{ success: boolean; data?: ScheduledReport; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { data, error } = await supabase
      .from("scheduled_reports")
      .update(updates)
      .eq("id", reportId)
      .select()
      .single();

    if (error) {
      logger.error("Error updating scheduled report", error, { reportId, updates });
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    logger.error("Error updating scheduled report", error, { reportId, updates });
    return { success: false, error: "Failed to update scheduled report" };
  }
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { error } = await supabase.from("scheduled_reports").delete().eq("id", reportId);

    if (error) {
      logger.error("Error deleting scheduled report", error, { reportId });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error deleting scheduled report", error, { reportId });
    return { success: false, error: "Failed to delete scheduled report" };
  }
}

/**
 * Mark a scheduled report as run
 */
export async function markScheduledReportRun(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("scheduled_reports")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", reportId);

    if (error) {
      logger.error("Error marking scheduled report as run", error, { reportId });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error marking scheduled report as run", error, { reportId });
    return { success: false, error: "Failed to mark scheduled report as run" };
  }
}
