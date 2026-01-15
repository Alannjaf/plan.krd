"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

export type DateRange = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

export type GroupBy = "day" | "week" | "month";

export type VelocityDataPoint = {
  date: string;
  completed: number;
  created: number;
};

export type BurndownDataPoint = {
  date: string;
  ideal: number;
  actual: number;
  remaining: number;
};

export type CycleTimeMetrics = {
  average: number; // in days
  median: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  data: Array<{ taskId: string; cycleTime: number }>;
};

export type DistributionData = {
  label: string;
  value: number;
  color?: string;
};

export type BoardHealth = {
  overdueTasks: number;
  atRiskTasks: number; // Due within 3 days
  agingTasks: number; // Created > 7 days ago, not completed
  throughput: number; // Tasks completed in last 7 days
  completionRate: number; // Percentage
  averageCycleTime: number; // in days
};

export type TaskAgingItem = {
  taskId: string;
  title: string;
  age: number; // days since creation
  daysOverdue: number | null;
  priority: string | null;
  assignees: Array<{ name: string; email: string }>;
  listName: string;
};

export type WorkloadData = {
  userId: string;
  userName: string;
  userEmail: string;
  taskCount: number;
  overdueCount: number;
  capacity: number; // percentage
};

export type CapacityMetrics = {
  totalCapacity: number;
  allocatedCapacity: number;
  availableCapacity: number;
  utilization: number; // percentage
  byUser: Array<{
    userId: string;
    userName: string;
    allocated: number;
    available: number;
  }>;
};

/**
 * Get team velocity - tasks completed over time
 */
export async function getTeamVelocity(params: {
  workspaceId?: string;
  boardId?: string;
  dateRange?: DateRange;
  groupBy?: GroupBy;
}): Promise<{ success: boolean; data?: VelocityDataPoint[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId, dateRange, groupBy = "day" } = params;

  try {
    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else if (workspaceId) {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (!boards) {
        return { success: false, error: "No boards found" };
      }
      boardIds = boards.map((b) => b.id);
    } else {
      return { success: false, error: "Either workspaceId or boardId must be provided" };
    }

    // Get list IDs for these boards
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: [] };
    }

    const listIds = lists.map((l) => l.id);

    // Build date filter
    let query = supabase
      .from("tasks")
      .select("created_at, completed_at, completed")
      .in("list_id", listIds)
      .eq("archived", false);

    if (dateRange?.from) {
      query = query.gte("created_at", dateRange.from);
    }
    if (dateRange?.to) {
      query = query.lte("created_at", dateRange.to);
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error("Error fetching tasks for velocity", error, params);
      return { success: false, error: error.message };
    }

    if (!tasks || tasks.length === 0) {
      return { success: true, data: [] };
    }

    // Group by date
    const grouped = new Map<string, { created: number; completed: number }>();

    tasks.forEach((task) => {
      const createdDate = new Date(task.created_at);
      const createdKey = formatDateByGroup(createdDate, groupBy);

      if (!grouped.has(createdKey)) {
        grouped.set(createdKey, { created: 0, completed: 0 });
      }
      const group = grouped.get(createdKey)!;
      group.created += 1;

      if (task.completed && task.completed_at) {
        const completedDate = new Date(task.completed_at);
        const completedKey = formatDateByGroup(completedDate, groupBy);

        if (!grouped.has(completedKey)) {
          grouped.set(completedKey, { created: 0, completed: 0 });
        }
        grouped.get(completedKey)!.completed += 1;
      }
    });

    // Convert to array and sort by date
    const data: VelocityDataPoint[] = Array.from(grouped.entries())
      .map(([date, counts]) => ({
        date,
        completed: counts.completed,
        created: counts.created,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data };
  } catch (error) {
    logger.error("Error calculating velocity", error, params);
    return { success: false, error: "Failed to calculate velocity" };
  }
}

/**
 * Get burndown data for a sprint/project
 */
export async function getBurndownData(params: {
  boardId: string;
  startDate: string;
  endDate: string;
  targetTasks?: number;
}): Promise<{ success: boolean; data?: BurndownDataPoint[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { boardId, startDate, endDate, targetTasks } = params;

  try {
    // Get all lists for this board
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .eq("board_id", boardId);

    if (!lists || lists.length === 0) {
      return { success: true, data: [] };
    }

    const listIds = lists.map((l) => l.id);

    // Get all tasks created before or during the sprint
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, created_at, completed_at, completed")
      .in("list_id", listIds)
      .eq("archived", false)
      .lte("created_at", endDate);

    if (!tasks || tasks.length === 0) {
      return { success: true, data: [] };
    }

    // Calculate total tasks (initial backlog)
    const totalTasks = targetTasks ?? tasks.length;

    // Generate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    // Calculate burndown
    const data: BurndownDataPoint[] = dates.map((date) => {
      // Ideal burndown (linear)
      const daysTotal = dates.length;
      const dayIndex = dates.indexOf(date);
      const ideal = Math.max(0, totalTasks - (totalTasks / daysTotal) * (dayIndex + 1));

      // Actual remaining tasks
      const completedByDate = tasks.filter(
        (task) => task.completed && task.completed_at && task.completed_at <= date + "T23:59:59"
      ).length;

      const remaining = totalTasks - completedByDate;

      return {
        date,
        ideal: Math.round(ideal * 100) / 100,
        actual: Math.max(0, remaining),
        remaining: Math.max(0, remaining),
      };
    });

    return { success: true, data };
  } catch (error) {
    logger.error("Error calculating burndown", error, params);
    return { success: false, error: "Failed to calculate burndown" };
  }
}

/**
 * Get cycle time metrics - time from creation to completion
 */
export async function getCycleTimeMetrics(params: {
  workspaceId?: string;
  boardId?: string;
  dateRange?: DateRange;
}): Promise<{ success: boolean; data?: CycleTimeMetrics; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId, dateRange } = params;

  try {
    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else if (workspaceId) {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (!boards) {
        return { success: false, error: "No boards found" };
      }
      boardIds = boards.map((b) => b.id);
    } else {
      return { success: false, error: "Either workspaceId or boardId must be provided" };
    }

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: { average: 0, median: 0, p50: 0, p75: 0, p90: 0, p95: 0, data: [] } };
    }

    const listIds = lists.map((l) => l.id);

    // Get completed tasks
    let query = supabase
      .from("tasks")
      .select("id, created_at, completed_at")
      .in("list_id", listIds)
      .eq("archived", false)
      .eq("completed", true)
      .not("completed_at", "is", null);

    if (dateRange?.from) {
      query = query.gte("completed_at", dateRange.from);
    }
    if (dateRange?.to) {
      query = query.lte("completed_at", dateRange.to);
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error("Error fetching tasks for cycle time", error, params);
      return { success: false, error: error.message };
    }

    if (!tasks || tasks.length === 0) {
      return { success: true, data: { average: 0, median: 0, p50: 0, p75: 0, p90: 0, p95: 0, data: [] } };
    }

    // Calculate cycle times in days
    const cycleTimes = tasks
      .map((task) => {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at!);
        const diffMs = completed.getTime() - created.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return {
          taskId: task.id,
          cycleTime: Math.max(0, diffDays),
        };
      })
      .filter((ct) => ct.cycleTime >= 0);

    if (cycleTimes.length === 0) {
      return { success: true, data: { average: 0, median: 0, p50: 0, p75: 0, p90: 0, p95: 0, data: [] } };
    }

    // Sort by cycle time
    cycleTimes.sort((a, b) => a.cycleTime - b.cycleTime);

    // Calculate metrics
    const sum = cycleTimes.reduce((acc, ct) => acc + ct.cycleTime, 0);
    const average = sum / cycleTimes.length;
    const median = cycleTimes[Math.floor(cycleTimes.length / 2)]?.cycleTime ?? 0;
    const p50 = median;
    const p75 = cycleTimes[Math.floor(cycleTimes.length * 0.75)]?.cycleTime ?? 0;
    const p90 = cycleTimes[Math.floor(cycleTimes.length * 0.9)]?.cycleTime ?? 0;
    const p95 = cycleTimes[Math.floor(cycleTimes.length * 0.95)]?.cycleTime ?? 0;

    return {
      success: true,
      data: {
        average: Math.round(average * 100) / 100,
        median: Math.round(median * 100) / 100,
        p50: Math.round(p50 * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
        p90: Math.round(p90 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        data: cycleTimes,
      },
    };
  } catch (error) {
    logger.error("Error calculating cycle time", error, params);
    return { success: false, error: "Failed to calculate cycle time" };
  }
}

/**
 * Get lead time metrics - time from creation to first move (list change)
 */
export async function getLeadTimeMetrics(params: {
  workspaceId?: string;
  boardId?: string;
  dateRange?: DateRange;
}): Promise<{ success: boolean; data?: CycleTimeMetrics; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId, dateRange } = params;

  try {
    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else if (workspaceId) {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (!boards) {
        return { success: false, error: "No boards found" };
      }
      boardIds = boards.map((b) => b.id);
    } else {
      return { success: false, error: "Either workspaceId or boardId must be provided" };
    }

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id, board_id, position")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: { average: 0, median: 0, p50: 0, p75: 0, p90: 0, p95: 0, data: [] } };
    }

    const listIds = lists.map((l) => l.id);
    const firstListIds = new Set(
      lists
        .filter((l) => {
          const boardLists = lists.filter((bl) => bl.board_id === l.board_id);
          const minPosition = Math.min(...boardLists.map((bl) => bl.position));
          return l.position === minPosition;
        })
        .map((l) => l.id)
    );

    // Get tasks and their first move activity
    let query = supabase
      .from("tasks")
      .select("id, created_at, list_id")
      .in("list_id", listIds)
      .eq("archived", false);

    if (dateRange?.from) {
      query = query.gte("created_at", dateRange.from);
    }
    if (dateRange?.to) {
      query = query.lte("created_at", dateRange.to);
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error("Error fetching tasks for lead time", error, params);
      return { success: false, error: error.message };
    }

    if (!tasks || tasks.length === 0) {
      return { success: true, data: { average: 0, median: 0, p50: 0, p75: 0, p90: 0, p95: 0, data: [] } };
    }

    // Get activities for moved tasks
    const taskIds = tasks.map((t) => t.id);
    const { data: activities } = await supabase
      .from("task_activities")
      .select("task_id, created_at, action, changes")
      .in("task_id", taskIds)
      .eq("action", "moved")
      .order("created_at", { ascending: true });

    // Calculate lead times
    const leadTimes: Array<{ taskId: string; leadTime: number }> = [];

    tasks.forEach((task) => {
      // If task was created in first list, find first move
      if (firstListIds.has(task.list_id)) {
        const firstMove = activities?.find((a) => a.task_id === task.id);
        if (firstMove) {
          const created = new Date(task.created_at);
          const moved = new Date(firstMove.created_at);
          const diffMs = moved.getTime() - created.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays >= 0) {
            leadTimes.push({
              taskId: task.id,
              leadTime: diffDays,
            });
          }
        }
      }
    });

    if (leadTimes.length === 0) {
      return { success: true, data: { average: 0, median: 0, p50: 0, p75: 0, p90: 0, p95: 0, data: [] } };
    }

    // Sort and calculate metrics
    leadTimes.sort((a, b) => a.leadTime - b.leadTime);

    const sum = leadTimes.reduce((acc, lt) => acc + lt.leadTime, 0);
    const average = sum / leadTimes.length;
    const median = leadTimes[Math.floor(leadTimes.length / 2)]?.leadTime ?? 0;
    const p50 = median;
    const p75 = leadTimes[Math.floor(leadTimes.length * 0.75)]?.leadTime ?? 0;
    const p90 = leadTimes[Math.floor(leadTimes.length * 0.9)]?.leadTime ?? 0;
    const p95 = leadTimes[Math.floor(leadTimes.length * 0.95)]?.leadTime ?? 0;

    return {
      success: true,
      data: {
        average: Math.round(average * 100) / 100,
        median: Math.round(median * 100) / 100,
        p50: Math.round(p50 * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
        p90: Math.round(p90 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        data: leadTimes.map((lt) => ({ taskId: lt.taskId, cycleTime: lt.leadTime })),
      },
    };
  } catch (error) {
    logger.error("Error calculating lead time", error, params);
    return { success: false, error: "Failed to calculate lead time" };
  }
}

/**
 * Get task distribution by priority, assignee, or label
 */
export async function getTaskDistribution(params: {
  workspaceId?: string;
  boardId?: string;
  groupBy: "priority" | "assignee" | "label";
  includeCompleted?: boolean;
}): Promise<{ success: boolean; data?: DistributionData[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId, groupBy, includeCompleted = false } = params;

  try {
    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else if (workspaceId) {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (!boards) {
        return { success: false, error: "No boards found" };
      }
      boardIds = boards.map((b) => b.id);
    } else {
      return { success: false, error: "Either workspaceId or boardId must be provided" };
    }

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: [] };
    }

    const listIds = lists.map((l) => l.id);

    // Get tasks with relations
    let query = supabase
      .from("tasks")
      .select(
        `
        id,
        priority,
        assignees:task_assignees(
          user_id,
          profiles:profiles!task_assignees_user_id_fkey(full_name, email)
        ),
        labels:task_labels(
          label_id,
          labels(name, color)
        ),
        completed
      `
      )
      .in("list_id", listIds)
      .eq("archived", false);

    if (!includeCompleted) {
      query = query.eq("completed", false);
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error("Error fetching tasks for distribution", error, params);
      return { success: false, error: error.message };
    }

    if (!tasks || tasks.length === 0) {
      return { success: true, data: [] };
    }

    // Group by specified field
    const distribution = new Map<string, number>();

    tasks.forEach((task: any) => {
      if (groupBy === "priority") {
        const priority = task.priority || "none";
        distribution.set(priority, (distribution.get(priority) || 0) + 1);
      } else if (groupBy === "assignee") {
        if (task.assignees && task.assignees.length > 0) {
          task.assignees.forEach((assignee: any) => {
            const name = assignee.profiles?.full_name || assignee.profiles?.email || "Unassigned";
            distribution.set(name, (distribution.get(name) || 0) + 1);
          });
        } else {
          distribution.set("Unassigned", (distribution.get("Unassigned") || 0) + 1);
        }
      } else if (groupBy === "label") {
        if (task.labels && task.labels.length > 0) {
          task.labels.forEach((label: any) => {
            const labelName = label.labels?.name || "Unlabeled";
            distribution.set(labelName, (distribution.get(labelName) || 0) + 1);
          });
        } else {
          distribution.set("Unlabeled", (distribution.get("Unlabeled") || 0) + 1);
        }
      }
    });

    // Convert to array
    const data: DistributionData[] = Array.from(distribution.entries()).map(([label, value]) => ({
      label,
      value,
    }));

    return { success: true, data };
  } catch (error) {
    logger.error("Error calculating distribution", error, params);
    return { success: false, error: "Failed to calculate distribution" };
  }
}

/**
 * Get completion rate trends over time
 */
export async function getCompletionRateTrends(params: {
  workspaceId?: string;
  boardId?: string;
  dateRange?: DateRange;
  groupBy?: GroupBy;
}): Promise<{ success: boolean; data?: Array<{ date: string; rate: number }>; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId, dateRange, groupBy = "week" } = params;

  try {
    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else if (workspaceId) {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (!boards) {
        return { success: false, error: "No boards found" };
      }
      boardIds = boards.map((b) => b.id);
    } else {
      return { success: false, error: "Either workspaceId or boardId must be provided" };
    }

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: [] };
    }

    const listIds = lists.map((l) => l.id);

    // Get all tasks
    let query = supabase
      .from("tasks")
      .select("created_at, completed_at, completed")
      .in("list_id", listIds)
      .eq("archived", false);

    if (dateRange?.from) {
      query = query.gte("created_at", dateRange.from);
    }
    if (dateRange?.to) {
      query = query.lte("created_at", dateRange.to);
    }

    const { data: tasks, error } = await query;

    if (error) {
      logger.error("Error fetching tasks for completion trends", error, params);
      return { success: false, error: error.message };
    }

    if (!tasks || tasks.length === 0) {
      return { success: true, data: [] };
    }

    // Group by date and calculate completion rate
    const grouped = new Map<string, { total: number; completed: number }>();

    tasks.forEach((task) => {
      const date = new Date(task.created_at);
      const key = formatDateByGroup(date, groupBy);

      if (!grouped.has(key)) {
        grouped.set(key, { total: 0, completed: 0 });
      }

      const group = grouped.get(key)!;
      group.total += 1;

      if (task.completed) {
        group.completed += 1;
      }
    });

    // Calculate rates
    const data = Array.from(grouped.entries())
      .map(([date, counts]) => ({
        date,
        rate: counts.total > 0 ? Math.round((counts.completed / counts.total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data };
  } catch (error) {
    logger.error("Error calculating completion trends", error, params);
    return { success: false, error: "Failed to calculate completion trends" };
  }
}

/**
 * Get board health indicators
 */
export async function getBoardHealth(params: {
  boardId: string;
}): Promise<{ success: boolean; data?: BoardHealth; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { boardId } = params;

  try {
    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .eq("board_id", boardId);

    if (!lists || lists.length === 0) {
      return {
        success: true,
        data: {
          overdueTasks: 0,
          atRiskTasks: 0,
          agingTasks: 0,
          throughput: 0,
          completionRate: 0,
          averageCycleTime: 0,
        },
      };
    }

    const listIds = lists.map((l) => l.id);

    // Get all tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, created_at, completed_at, completed, due_date")
      .in("list_id", listIds)
      .eq("archived", false);

    if (!tasks || tasks.length === 0) {
      return {
        success: true,
        data: {
          overdueTasks: 0,
          atRiskTasks: 0,
          agingTasks: 0,
          throughput: 0,
          completionRate: 0,
          averageCycleTime: 0,
        },
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const sevenDaysAgoCreated = new Date(today);
    sevenDaysAgoCreated.setDate(sevenDaysAgoCreated.getDate() - 7);

    // Calculate metrics
    let overdueTasks = 0;
    let atRiskTasks = 0;
    let agingTasks = 0;
    let completedLast7Days = 0;
    let totalCompleted = 0;
    const cycleTimes: number[] = [];

    tasks.forEach((task) => {
      // Overdue tasks
      if (!task.completed && task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate < today) {
          overdueTasks += 1;
        } else if (dueDate <= threeDaysFromNow) {
          atRiskTasks += 1;
        }
      }

      // Aging tasks (created > 7 days ago, not completed)
      if (!task.completed) {
        const created = new Date(task.created_at);
        if (created < sevenDaysAgoCreated) {
          agingTasks += 1;
        }
      }

      // Throughput (completed in last 7 days)
      if (task.completed && task.completed_at) {
        const completed = new Date(task.completed_at);
        if (completed >= sevenDaysAgo) {
          completedLast7Days += 1;
        }
        totalCompleted += 1;

        // Cycle time
        const created = new Date(task.created_at);
        const diffMs = completed.getTime() - created.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays >= 0) {
          cycleTimes.push(diffDays);
        }
      }
    });

    const completionRate = tasks.length > 0 ? (totalCompleted / tasks.length) * 100 : 0;
    const averageCycleTime =
      cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;

    return {
      success: true,
      data: {
        overdueTasks,
        atRiskTasks,
        agingTasks,
        throughput: completedLast7Days,
        completionRate: Math.round(completionRate * 100) / 100,
        averageCycleTime: Math.round(averageCycleTime * 100) / 100,
      },
    };
  } catch (error) {
    logger.error("Error calculating board health", error, params);
    return { success: false, error: "Failed to calculate board health" };
  }
}

/**
 * Get task aging report
 */
export async function getTaskAgingReport(params: {
  workspaceId?: string;
  boardId?: string;
}): Promise<{ success: boolean; data?: TaskAgingItem[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId } = params;

  try {
    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else if (workspaceId) {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (!boards) {
        return { success: false, error: "No boards found" };
      }
      boardIds = boards.map((b) => b.id);
    } else {
      return { success: false, error: "Either workspaceId or boardId must be provided" };
    }

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id, name, board_id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: [] };
    }

    const listIds = lists.map((l) => l.id);
    const listNameMap = new Map(lists.map((l) => [l.id, l.name]));

    // Get incomplete tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select(
        `
        id,
        title,
        created_at,
        due_date,
        priority,
        list_id,
        assignees:task_assignees(
          profiles:profiles!task_assignees_user_id_fkey(full_name, email)
        )
      `
      )
      .in("list_id", listIds)
      .eq("archived", false)
      .eq("completed", false);

    if (!tasks || tasks.length === 0) {
      return { success: true, data: [] };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calculate aging
    const data: TaskAgingItem[] = tasks.map((task: any) => {
      const created = new Date(task.created_at);
      const ageMs = now.getTime() - created.getTime();
      const age = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      let daysOverdue: number | null = null;
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate < today) {
          const overdueMs = today.getTime() - dueDate.getTime();
          daysOverdue = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
        }
      }

      const assignees = (task.assignees || []).map((a: any) => ({
        name: a.profiles?.full_name || a.profiles?.email || "Unknown",
        email: a.profiles?.email || "",
      }));

      return {
        taskId: task.id,
        title: task.title,
        age,
        daysOverdue,
        priority: task.priority || "none",
        assignees,
        listName: listNameMap.get(task.list_id) || "Unknown",
      };
    });

    // Sort by age (oldest first)
    data.sort((a, b) => b.age - a.age);

    return { success: true, data };
  } catch (error) {
    logger.error("Error calculating task aging", error, params);
    return { success: false, error: "Failed to calculate task aging" };
  }
}

/**
 * Get workload distribution
 */
export async function getWorkloadDistribution(params: {
  workspaceId: string;
  boardId?: string;
}): Promise<{ success: boolean; data?: WorkloadData[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId } = params;

  try {
    // Get workspace members
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, profiles:profiles!workspace_members_user_id_fkey(full_name, email)")
      .eq("workspace_id", workspaceId);

    if (!members || members.length === 0) {
      return { success: true, data: [] };
    }

    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (boards) {
        boardIds = boards.map((b) => b.id);
      }
    }

    if (boardIds.length === 0) {
      return { success: true, data: [] };
    }

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: [] };
    }

    const listIds = lists.map((l) => l.id);

    // Get tasks with assignees
    const { data: tasks } = await supabase
      .from("tasks")
      .select(
        `
        id,
        due_date,
        completed,
        assignees:task_assignees(
          user_id,
          profiles:profiles!task_assignees_user_id_fkey(full_name, email)
        )
      `
      )
      .in("list_id", listIds)
      .eq("archived", false)
      .eq("completed", false);

    if (!tasks || tasks.length === 0) {
      return { success: true, data: [] };
    }

    // Calculate workload per user
    const workloadMap = new Map<string, WorkloadData>();

    members.forEach((member: any) => {
      const userId = member.user_id;
      const profile = member.profiles;
      workloadMap.set(userId, {
        userId,
        userName: profile?.full_name || profile?.email || "Unknown",
        userEmail: profile?.email || "",
        taskCount: 0,
        overdueCount: 0,
        capacity: 0,
      });
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    tasks.forEach((task: any) => {
      if (task.assignees && task.assignees.length > 0) {
        task.assignees.forEach((assignee: any) => {
          const userId = assignee.user_id;
          const workload = workloadMap.get(userId);
          if (workload) {
            workload.taskCount += 1;

            if (task.due_date) {
              const dueDate = new Date(task.due_date);
              if (dueDate < today) {
                workload.overdueCount += 1;
              }
            }
          }
        });
      }
    });

    // Calculate capacity (assuming max 10 tasks per user)
    const MAX_CAPACITY = 10;
    workloadMap.forEach((workload) => {
      workload.capacity = Math.min(100, Math.round((workload.taskCount / MAX_CAPACITY) * 100));
    });

    const data = Array.from(workloadMap.values()).sort((a, b) => b.taskCount - a.taskCount);

    return { success: true, data };
  } catch (error) {
    logger.error("Error calculating workload distribution", error, params);
    return { success: false, error: "Failed to calculate workload distribution" };
  }
}

/**
 * Get capacity planning metrics
 */
export async function getCapacityMetrics(params: {
  workspaceId: string;
  boardId?: string;
}): Promise<{ success: boolean; data?: CapacityMetrics; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId } = params;

  try {
    // Get workspace members
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, profiles:profiles!workspace_members_user_id_fkey(full_name, email)")
      .eq("workspace_id", workspaceId);

    if (!members || members.length === 0) {
      return {
        success: true,
        data: {
          totalCapacity: 0,
          allocatedCapacity: 0,
          availableCapacity: 0,
          utilization: 0,
          byUser: [],
        },
      };
    }

    // Get board IDs
    let boardIds: string[] = [];
    if (boardId) {
      boardIds = [boardId];
    } else {
      const { data: boards } = await supabase
        .from("boards")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false);

      if (boards) {
        boardIds = boards.map((b) => b.id);
      }
    }

    if (boardIds.length === 0) {
      return {
        success: true,
        data: {
          totalCapacity: members.length * 10,
          allocatedCapacity: 0,
          availableCapacity: members.length * 10,
          utilization: 0,
          byUser: [],
        },
      };
    }

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return {
        success: true,
        data: {
          totalCapacity: members.length * 10,
          allocatedCapacity: 0,
          availableCapacity: members.length * 10,
          utilization: 0,
          byUser: [],
        },
      };
    }

    const listIds = lists.map((l) => l.id);

    // Get incomplete tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, assignees:task_assignees(user_id)")
      .in("list_id", listIds)
      .eq("archived", false)
      .eq("completed", false);

    // Calculate capacity
    const MAX_CAPACITY_PER_USER = 10;
    const totalCapacity = members.length * MAX_CAPACITY_PER_USER;

    const userCapacity = new Map<string, number>();
    members.forEach((member: any) => {
      userCapacity.set(member.user_id, 0);
    });

    if (tasks) {
      tasks.forEach((task: any) => {
        if (task.assignees && task.assignees.length > 0) {
          task.assignees.forEach((assignee: any) => {
            const current = userCapacity.get(assignee.user_id) || 0;
            userCapacity.set(assignee.user_id, current + 1);
          });
        }
      });
    }

    const allocatedCapacity = Array.from(userCapacity.values()).reduce((a, b) => a + b, 0);
    const availableCapacity = totalCapacity - allocatedCapacity;
    const utilization = totalCapacity > 0 ? (allocatedCapacity / totalCapacity) * 100 : 0;

    const byUser = members.map((member: any) => {
      const allocated = userCapacity.get(member.user_id) || 0;
      return {
        userId: member.user_id,
        userName: member.profiles?.full_name || member.profiles?.email || "Unknown",
        allocated,
        available: MAX_CAPACITY_PER_USER - allocated,
      };
    });

    return {
      success: true,
      data: {
        totalCapacity,
        allocatedCapacity,
        availableCapacity,
        utilization: Math.round(utilization * 100) / 100,
        byUser,
      },
    };
  } catch (error) {
    logger.error("Error calculating capacity metrics", error, params);
    return { success: false, error: "Failed to calculate capacity metrics" };
  }
}

/**
 * Get individual productivity metrics
 */
export async function getIndividualProductivity(params: {
  workspaceId: string;
  userId?: string;
  dateRange?: DateRange;
}): Promise<{
  success: boolean;
  data?: Array<{
    userId: string;
    userName: string;
    tasksCompleted: number;
    averageCycleTime: number;
    tasksCreated: number;
  }>;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, userId, dateRange } = params;

  try {
    // Get workspace members
    let members;
    if (userId) {
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id, profiles:profiles!workspace_members_user_id_fkey(full_name, email)")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId);
      members = data;
    } else {
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id, profiles:profiles!workspace_members_user_id_fkey(full_name, email)")
        .eq("workspace_id", workspaceId);
      members = data;
    }

    if (!members || members.length === 0) {
      return { success: true, data: [] };
    }

    // Get board IDs
    const { data: boards } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("archived", false);

    if (!boards || boards.length === 0) {
      return { success: true, data: [] };
    }

    const boardIds = boards.map((b) => b.id);

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return { success: true, data: [] };
    }

    const listIds = lists.map((l) => l.id);

    // Get tasks
    let query = supabase
      .from("tasks")
      .select("id, created_at, completed_at, completed, created_by")
      .in("list_id", listIds)
      .eq("archived", false);

    if (dateRange?.from) {
      query = query.gte("created_at", dateRange.from);
    }
    if (dateRange?.to) {
      query = query.lte("created_at", dateRange.to);
    }

    const { data: tasks } = await query;

    if (!tasks || tasks.length === 0) {
      return {
        success: true,
        data: members.map((m: any) => ({
          userId: m.user_id,
          userName: m.profiles?.full_name || m.profiles?.email || "Unknown",
          tasksCompleted: 0,
          averageCycleTime: 0,
          tasksCreated: 0,
        })),
      };
    }

    // Get task assignees for completed tasks
    const completedTaskIds = tasks.filter((t) => t.completed).map((t) => t.id);
    const { data: assignees } = await supabase
      .from("task_assignees")
      .select("task_id, user_id")
      .in("task_id", completedTaskIds);

    // Calculate metrics per user
    const userMetrics = new Map<
      string,
      { tasksCompleted: number; cycleTimes: number[]; tasksCreated: number }
    >();

    members.forEach((member: any) => {
      userMetrics.set(member.user_id, {
        tasksCompleted: 0,
        cycleTimes: [],
        tasksCreated: 0,
      });
    });

    tasks.forEach((task) => {
      // Tasks created
      if (task.created_by) {
        const metrics = userMetrics.get(task.created_by);
        if (metrics) {
          metrics.tasksCreated += 1;
        }
      }

      // Tasks completed
      if (task.completed && task.completed_at) {
        const taskAssignees = assignees?.filter((a) => a.task_id === task.id) || [];
        taskAssignees.forEach((assignee) => {
          const metrics = userMetrics.get(assignee.user_id);
          if (metrics) {
            metrics.tasksCompleted += 1;

            // Cycle time
            const created = new Date(task.created_at);
            const completed = new Date(task.completed_at);
            const diffMs = completed.getTime() - created.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays >= 0) {
              metrics.cycleTimes.push(diffDays);
            }
          }
        });
      }
    });

    // Format results
    const data = members.map((member: any) => {
      const metrics = userMetrics.get(member.user_id) || {
        tasksCompleted: 0,
        cycleTimes: [],
        tasksCreated: 0,
      };

      const averageCycleTime =
        metrics.cycleTimes.length > 0
          ? metrics.cycleTimes.reduce((a, b) => a + b, 0) / metrics.cycleTimes.length
          : 0;

      return {
        userId: member.user_id,
        userName: member.profiles?.full_name || member.profiles?.email || "Unknown",
        tasksCompleted: metrics.tasksCompleted,
        averageCycleTime: Math.round(averageCycleTime * 100) / 100,
        tasksCreated: metrics.tasksCreated,
      };
    });

    return { success: true, data };
  } catch (error) {
    logger.error("Error calculating individual productivity", error, params);
    return { success: false, error: "Failed to calculate individual productivity" };
  }
}

/**
 * Get team productivity metrics
 */
export async function getTeamProductivity(params: {
  workspaceId: string;
  dateRange?: DateRange;
}): Promise<{
  success: boolean;
  data?: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageCycleTime: number;
    throughput: number; // tasks completed per week
  };
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, dateRange } = params;

  try {
    // Get board IDs
    const { data: boards } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("archived", false);

    if (!boards || boards.length === 0) {
      return {
        success: true,
        data: {
          totalTasks: 0,
          completedTasks: 0,
          completionRate: 0,
          averageCycleTime: 0,
          throughput: 0,
        },
      };
    }

    const boardIds = boards.map((b) => b.id);

    // Get list IDs
    const { data: lists } = await supabase
      .from("lists")
      .select("id")
      .in("board_id", boardIds);

    if (!lists || lists.length === 0) {
      return {
        success: true,
        data: {
          totalTasks: 0,
          completedTasks: 0,
          completionRate: 0,
          averageCycleTime: 0,
          throughput: 0,
        },
      };
    }

    const listIds = lists.map((l) => l.id);

    // Get tasks
    let query = supabase
      .from("tasks")
      .select("id, created_at, completed_at, completed")
      .in("list_id", listIds)
      .eq("archived", false);

    if (dateRange?.from) {
      query = query.gte("created_at", dateRange.from);
    }
    if (dateRange?.to) {
      query = query.lte("created_at", dateRange.to);
    }

    const { data: tasks } = await query;

    if (!tasks || tasks.length === 0) {
      return {
        success: true,
        data: {
          totalTasks: 0,
          completedTasks: 0,
          completionRate: 0,
          averageCycleTime: 0,
          throughput: 0,
        },
      };
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate average cycle time
    const cycleTimes = tasks
      .filter((t) => t.completed && t.completed_at)
      .map((t) => {
        const created = new Date(t.created_at);
        const completed = new Date(t.completed_at!);
        const diffMs = completed.getTime() - created.getTime();
        return diffMs / (1000 * 60 * 60 * 24);
      })
      .filter((ct) => ct >= 0);

    const averageCycleTime =
      cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;

    // Calculate throughput (tasks completed per week)
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const completedLastWeek = tasks.filter(
      (t) => t.completed && t.completed_at && new Date(t.completed_at) >= oneWeekAgo
    ).length;

    return {
      success: true,
      data: {
        totalTasks,
        completedTasks,
        completionRate: Math.round(completionRate * 100) / 100,
        averageCycleTime: Math.round(averageCycleTime * 100) / 100,
        throughput: completedLastWeek,
      },
    };
  } catch (error) {
    logger.error("Error calculating team productivity", error, params);
    return { success: false, error: "Failed to calculate team productivity" };
  }
}

/**
 * Helper function to format date by group
 */
function formatDateByGroup(date: Date, groupBy: GroupBy): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (groupBy === "day") {
    return `${year}-${month}-${day}`;
  } else if (groupBy === "week") {
    // Get week number (ISO week)
    const d = new Date(Date.UTC(year, date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${year}-W${String(weekNo).padStart(2, "0")}`;
  } else {
    // month
    return `${year}-${month}`;
  }
}
