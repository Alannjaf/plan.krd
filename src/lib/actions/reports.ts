"use server";

import { createClient } from "@/lib/supabase/server";
import type { TaskWithRelations, Task } from "./tasks";

// Type for raw Supabase task response with nested relations
type RawTaskAssignee = {
  id: string;
  user_id: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type RawTaskLabel = {
  id: string;
  label_id: string;
  labels: {
    id: string;
    name: string;
    color: string;
  } | null;
};

type RawSubtask = {
  id: string;
  title: string;
  completed: boolean;
  position: number;
  due_date: string | null;
  assignee_id: string | null;
  assignee: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type RawTaskResponse = Task & {
  assignees: RawTaskAssignee[] | null;
  labels: RawTaskLabel[] | null;
  subtasks: RawSubtask[] | null;
  custom_field_values?: Array<{
    id: string;
    field_id: string;
    value: string | null;
    custom_field: {
      id: string;
      name: string;
      field_type: "text" | "number" | "dropdown";
      options: string[];
      required: boolean;
      position: number;
    } | null;
  }> | null;
};

export type ReportFilters = {
  completed?: boolean;
  dateRange?: {
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
  };
  assigneeId?: string;
  labelId?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  listId?: string;
};

export type ReportFieldSelection = string[] | "all";

/**
 * Strip HTML tags from text content
 */
function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Escape CSV field value (handles quotes, commas, newlines)
 */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n") || stringValue.includes("\r")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Fetch completed tasks with full relations for a board
 */
async function fetchCompletedTasksForBoard(
  boardId: string,
  filters: ReportFilters
): Promise<TaskWithRelations[]> {
  const supabase = await createClient();

  // Get all lists for this board
  const { data: lists } = await supabase
    .from("lists")
    .select("id, name")
    .eq("board_id", boardId)
    .order("position");

  if (!lists || lists.length === 0) {
    return [];
  }

  const listIds = lists.map((l) => l.id);
  const listNameMap = new Map(lists.map((l) => [l.id, l.name]));

  // Build query for tasks
  let query = supabase
    .from("tasks")
    .select(`
      *,
      lists!inner(board_id),
      assignees:task_assignees(
        id,
        user_id,
        profiles:profiles!task_assignees_user_id_fkey(id, email, full_name, avatar_url)
      ),
      labels:task_labels(
        id,
        label_id,
        labels(id, name, color)
      ),
      subtasks(
        id,
        title,
        completed,
        position,
        due_date,
        assignee_id,
        assignee:profiles!subtasks_assignee_id_fkey(id, email, full_name, avatar_url)
      ),
      custom_field_values(
        id,
        field_id,
        value,
        custom_field:custom_fields(id, name, field_type, options, required, position)
      )
    `)
    .eq("lists.board_id", boardId)
    .eq("archived", false);

  // Filter by completion status if specified
  if (filters.completed !== undefined) {
    query = query.eq("completed", filters.completed);
  }

  // Apply filters
  if (filters.listId) {
    query = query.eq("list_id", filters.listId);
  } else {
    query = query.in("list_id", listIds);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.dateRange?.from) {
    query = query.gte("completed_at", filters.dateRange.from);
  }

  if (filters.dateRange?.to) {
    query = query.lte("completed_at", filters.dateRange.to);
  }

  // Order by created_at for all tasks, or completed_at if only completed tasks
  const { data: tasks, error } = await query.order(
    filters.completed === true ? "completed_at" : "created_at",
    { ascending: false }
  );

  if (error) {
    console.error("Error fetching tasks for report:", error);
    return [];
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Filter by assignee and label (client-side filtering as they're in nested relations)
  let filteredTasks = tasks as RawTaskResponse[];

  if (filters.assigneeId) {
    filteredTasks = filteredTasks.filter((task) => {
      const assignees = task.assignees || [];
      return assignees.some((a) => a.user_id === filters.assigneeId);
    });
  }

  if (filters.labelId) {
    filteredTasks = filteredTasks.filter((task) => {
      const labels = task.labels || [];
      return labels.some((l) => l.label_id === filters.labelId);
    });
  }

  // Transform to TaskWithRelations format
  const taskIds = filteredTasks.map((t) => t.id);

  // Get counts in parallel
  const [attachmentsResult, commentsResult] = await Promise.all([
    supabase
      .from("attachments")
      .select("task_id")
      .in("task_id", taskIds),
    supabase
      .from("comments")
      .select("task_id")
      .in("task_id", taskIds),
  ]);

  const attachmentsCountByTask = new Map<string, number>();
  const commentsCountByTask = new Map<string, number>();

  attachmentsResult.data?.forEach((a) => {
    const count = attachmentsCountByTask.get(a.task_id) || 0;
    attachmentsCountByTask.set(a.task_id, count + 1);
  });

  commentsResult.data?.forEach((c) => {
    const count = commentsCountByTask.get(c.task_id) || 0;
    commentsCountByTask.set(c.task_id, count + 1);
  });

  // Transform tasks
  return filteredTasks.map((task) => {
    // Sort custom field values by field position
    const sortedCustomFieldValues = (task.custom_field_values || [])
      .filter((cfv) => cfv.custom_field)
      .sort((a, b) => {
        const posA = a.custom_field?.position ?? 0;
        const posB = b.custom_field?.position ?? 0;
        return posA - posB;
      });

    return {
      ...task,
      assignees: (task.assignees || []).map((a) => ({
        id: a.id,
        user_id: a.user_id,
        profiles: a.profiles || {
          id: "",
          email: null,
          full_name: null,
          avatar_url: null,
        },
      })),
      labels: (task.labels || []).map((l) => ({
        id: l.id,
        label_id: l.label_id,
        labels: l.labels || {
          id: "",
          name: "",
          color: "",
        },
      })),
      subtasks: (task.subtasks || []).sort((a, b) => a.position - b.position).map((s) => ({
        id: s.id,
        title: s.title,
        completed: s.completed,
        position: s.position,
        due_date: s.due_date,
        assignee_id: s.assignee_id,
        assignee: s.assignee as {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
        } | null,
      })),
      custom_field_values: sortedCustomFieldValues,
      attachments_count: attachmentsCountByTask.get(task.id) || 0,
      comments_count: commentsCountByTask.get(task.id) || 0,
    } as TaskWithRelations;
  });
}

/**
 * Fetch completed tasks for a workspace (all boards)
 */
async function fetchCompletedTasksForWorkspace(
  workspaceId: string,
  filters: ReportFilters
): Promise<TaskWithRelations[]> {
  const supabase = await createClient();

  // Get all boards in this workspace
  const { data: boards } = await supabase
    .from("boards")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("archived", false);

  if (!boards || boards.length === 0) {
    return [];
  }

  const boardIds = boards.map((b) => b.id);

  // Get all lists for those boards
  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, board_id")
    .in("board_id", boardIds)
    .order("position");

  if (!lists || lists.length === 0) {
    return [];
  }

  const listIds = lists.map((l) => l.id);
  const listNameMap = new Map(lists.map((l) => [l.id, l.name]));

  // Build query
  let query = supabase
    .from("tasks")
    .select(`
      *,
      lists!inner(board_id),
      assignees:task_assignees(
        id,
        user_id,
        profiles:profiles!task_assignees_user_id_fkey(id, email, full_name, avatar_url)
      ),
      labels:task_labels(
        id,
        label_id,
        labels(id, name, color)
      ),
      subtasks(
        id,
        title,
        completed,
        position,
        due_date,
        assignee_id,
        assignee:profiles!subtasks_assignee_id_fkey(id, email, full_name, avatar_url)
      ),
      custom_field_values(
        id,
        field_id,
        value,
        custom_field:custom_fields(id, name, field_type, options, required, position)
      )
    `)
    .in("lists.board_id", boardIds)
    .eq("archived", false);

  // Filter by completion status if specified
  if (filters.completed !== undefined) {
    query = query.eq("completed", filters.completed);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.dateRange?.from) {
    query = query.gte("completed_at", filters.dateRange.from);
  }

  if (filters.dateRange?.to) {
    query = query.lte("completed_at", filters.dateRange.to);
  }

  // Order by created_at for all tasks, or completed_at if only completed tasks
  const { data: tasks, error } = await query.order(
    filters.completed === true ? "completed_at" : "created_at",
    { ascending: false }
  );

  if (error) {
    console.error("Error fetching tasks for report:", error);
    return [];
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Filter by assignee and label
  let filteredTasks = tasks as RawTaskResponse[];

  if (filters.assigneeId) {
    filteredTasks = filteredTasks.filter((task) => {
      const assignees = task.assignees || [];
      return assignees.some((a) => a.user_id === filters.assigneeId);
    });
  }

  if (filters.labelId) {
    filteredTasks = filteredTasks.filter((task) => {
      const labels = task.labels || [];
      return labels.some((l) => l.label_id === filters.labelId);
    });
  }

  // Transform tasks
  const taskIds = filteredTasks.map((t) => t.id);

  const [attachmentsResult, commentsResult] = await Promise.all([
    supabase
      .from("attachments")
      .select("task_id")
      .in("task_id", taskIds),
    supabase
      .from("comments")
      .select("task_id")
      .in("task_id", taskIds),
  ]);

  const attachmentsCountByTask = new Map<string, number>();
  const commentsCountByTask = new Map<string, number>();

  attachmentsResult.data?.forEach((a) => {
    const count = attachmentsCountByTask.get(a.task_id) || 0;
    attachmentsCountByTask.set(a.task_id, count + 1);
  });

  commentsResult.data?.forEach((c) => {
    const count = commentsCountByTask.get(c.task_id) || 0;
    commentsCountByTask.set(c.task_id, count + 1);
  });

  return filteredTasks.map((task) => {
    const sortedCustomFieldValues = (task.custom_field_values || [])
      .filter((cfv) => cfv.custom_field)
      .sort((a, b) => {
        const posA = a.custom_field?.position ?? 0;
        const posB = b.custom_field?.position ?? 0;
        return posA - posB;
      });

    return {
      ...task,
      assignees: (task.assignees || []).map((a) => ({
        id: a.id,
        user_id: a.user_id,
        profiles: a.profiles || {
          id: "",
          email: null,
          full_name: null,
          avatar_url: null,
        },
      })),
      labels: (task.labels || []).map((l) => ({
        id: l.id,
        label_id: l.label_id,
        labels: l.labels || {
          id: "",
          name: "",
          color: "",
        },
      })),
      subtasks: (task.subtasks || []).sort((a, b) => a.position - b.position).map((s) => ({
        id: s.id,
        title: s.title,
        completed: s.completed,
        position: s.position,
        due_date: s.due_date,
        assignee_id: s.assignee_id,
        assignee: s.assignee as {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
        } | null,
      })),
      custom_field_values: sortedCustomFieldValues,
      attachments_count: attachmentsCountByTask.get(task.id) || 0,
      comments_count: commentsCountByTask.get(task.id) || 0,
    } as TaskWithRelations;
  });
}

/**
 * Generate CSV report for tasks
 */
export async function generateTaskReport(params: {
  boardId?: string;
  workspaceId?: string;
  filters?: ReportFilters;
  fields?: ReportFieldSelection;
}): Promise<{ success: boolean; csv?: string; error?: string }> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { boardId, workspaceId, filters = {}, fields = "all" } = params;

  if (!boardId && !workspaceId) {
    return { success: false, error: "Either boardId or workspaceId must be provided" };
  }

  // Fetch tasks
  const tasks = boardId
    ? await fetchCompletedTasksForBoard(boardId, filters)
    : await fetchCompletedTasksForWorkspace(workspaceId!, filters);

  console.log("[Report] Fetched tasks:", tasks.length, "filters:", filters);

  if (tasks.length === 0) {
    // Return CSV with headers only
    const headers = [
      "Title",
      "Description",
      "Priority",
      "Due Date",
      "Start Date",
      "Completed At",
      "Status/List",
      "Assignees",
      "Labels",
      "Subtasks",
      "Subtask Deadlines",
      "Subtask Assignees",
    ];
    return { success: true, csv: headers.join(",") + "\n" };
  }

  // Get all custom fields from the first task's board
  const firstTask = tasks[0];
  let allCustomFields: Array<{ id: string; name: string; position: number }> = [];

  if (boardId) {
    const { data: customFields } = await supabase
      .from("custom_fields")
      .select("id, name, position")
      .eq("board_id", boardId)
      .order("position");

    if (customFields) {
      allCustomFields = customFields;
    }
  } else if (workspaceId) {
    // Get all custom fields from all boards in workspace
    const { data: boards } = await supabase
      .from("boards")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("archived", false);

    if (boards && boards.length > 0) {
      const boardIds = boards.map((b) => b.id);
      const { data: customFields } = await supabase
        .from("custom_fields")
        .select("id, name, position, board_id")
        .in("board_id", boardIds)
        .order("position");

      if (customFields) {
        // Use a Set to get unique field names (assuming same field name = same field across boards)
        const fieldMap = new Map<string, { id: string; name: string; position: number }>();
        customFields.forEach((cf) => {
          if (!fieldMap.has(cf.name)) {
            fieldMap.set(cf.name, { id: cf.id, name: cf.name, position: cf.position });
          }
        });
        allCustomFields = Array.from(fieldMap.values()).sort((a, b) => a.position - b.position);
      }
    }
  }

  // Build CSV headers
  const standardHeaders = [
    "Title",
    "Description",
    "Priority",
    "Due Date",
    "Start Date",
    "Completed At",
    "Status/List",
    "Assignees",
    "Labels",
    "Subtasks",
    "Subtask Deadlines",
    "Subtask Assignees",
  ];

  const customFieldHeaders = allCustomFields.map((cf) => escapeCsvField(cf.name));
  const headers = [...standardHeaders, ...customFieldHeaders];

  // Get list names for all tasks
  const listIds = Array.from(new Set(tasks.map((t) => t.list_id)));
  const { data: allLists } = await supabase
    .from("lists")
    .select("id, name")
    .in("id", listIds);

  const listNameMap = new Map<string, string>();
  if (allLists) {
    allLists.forEach((list) => {
      listNameMap.set(list.id, list.name);
    });
  }

  // Build CSV rows
  const rows: string[] = [];

  for (const task of tasks) {
    // Get list name from listNameMap
    const listName = listNameMap.get(task.list_id) || "Unknown";

    // Get assignee names
    const assigneeNames = (task.assignees || [])
      .map((a) => a.profiles?.full_name || a.profiles?.email || "Unknown")
      .join(", ");

    // Get label names
    const labelNames = (task.labels || [])
      .map((l) => l.labels?.name || "")
      .filter((n) => n)
      .join(", ");

    // Get subtask information
    const subtaskTitles = (task.subtasks || [])
      .map((st) => st.title || "")
      .filter((t) => t)
      .join(", ");
    
    const subtaskDeadlines = (task.subtasks || [])
      .map((st) => st.due_date || "")
      .join(", ");
    
    const subtaskAssignees = (task.subtasks || [])
      .map((st) => {
        if (st.assignee) {
          return st.assignee.full_name || st.assignee.email || "Unknown";
        }
        return "";
      })
      .filter((a) => a)
      .join(", ");

    // Build custom field values map
    const customFieldValuesMap = new Map<string, string>();
    (task.custom_field_values || []).forEach((cfv) => {
      if (cfv.custom_field) {
        customFieldValuesMap.set(cfv.custom_field.id, cfv.value || "");
      }
    });

    // Strip HTML from description
    const cleanDescription = stripHtmlTags(task.description);

    // Build row
    const row = [
      escapeCsvField(task.title),
      escapeCsvField(cleanDescription),
      escapeCsvField(task.priority),
      escapeCsvField(task.due_date),
      escapeCsvField(task.start_date),
      escapeCsvField(task.completed_at),
      escapeCsvField(listName),
      escapeCsvField(assigneeNames),
      escapeCsvField(labelNames),
      escapeCsvField(subtaskTitles),
      escapeCsvField(subtaskDeadlines),
      escapeCsvField(subtaskAssignees),
      ...allCustomFields.map((cf) => escapeCsvField(customFieldValuesMap.get(cf.id) || "")),
    ];

    rows.push(row.join(","));
  }

  // Combine headers and rows
  const csvContent = [headers.join(","), ...rows].join("\n");

  // Add UTF-8 BOM for Excel compatibility
  const csvWithBom = "\uFEFF" + csvContent;

  return { success: true, csv: csvWithBom };
}