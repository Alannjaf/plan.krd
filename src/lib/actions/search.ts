"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResult = {
  type: "workspace" | "board" | "task";
  id: string;
  title: string;
  description: string | null;
  workspaceId: string;
  workspaceName: string;
  boardId?: string;
  boardName?: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const supabase = await createClient();
  const searchPattern = `%${query}%`;
  const results: SearchResult[] = [];

  // Search workspaces
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, description")
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
    .limit(5);

  if (workspaces) {
    results.push(
      ...workspaces.map((w) => ({
        type: "workspace" as const,
        id: w.id,
        title: w.name,
        description: w.description,
        workspaceId: w.id,
        workspaceName: w.name,
      }))
    );
  }

  // Search boards
  const { data: boards } = await supabase
    .from("boards")
    .select("id, name, description, workspace_id, workspaces(name)")
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
    .eq("archived", false)
    .limit(5);

  if (boards) {
    results.push(
      ...boards.map((b) => ({
        type: "board" as const,
        id: b.id,
        title: b.name,
        description: b.description,
        workspaceId: b.workspace_id,
        workspaceName: (b.workspaces as { name: string })?.name || "",
        boardId: b.id,
        boardName: b.name,
      }))
    );
  }

  // Search tasks (title and description)
  const { data: tasks } = await supabase
    .from("tasks")
    .select(`
      id, 
      title, 
      description,
      lists!inner(
        id,
        boards!inner(
          id,
          name,
          workspace_id,
          workspaces(name)
        )
      )
    `)
    .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
    .eq("archived", false)
    .limit(10);

  if (tasks) {
    results.push(
      ...tasks.map((t) => {
        const list = t.lists as unknown as {
          id: string;
          boards: {
            id: string;
            name: string;
            workspace_id: string;
            workspaces: { name: string };
          };
        };
        return {
          type: "task" as const,
          id: t.id,
          title: t.title,
          description: t.description,
          workspaceId: list.boards.workspace_id,
          workspaceName: list.boards.workspaces?.name || "",
          boardId: list.boards.id,
          boardName: list.boards.name,
        };
      })
    );
  }

  // Search tasks by attachment filename
  const { data: tasksWithAttachments } = await supabase
    .from("attachments")
    .select(`
      task_id,
      file_name,
      tasks!inner(
        id,
        title,
        description,
        archived,
        lists!inner(
          id,
          boards!inner(
            id,
            name,
            workspace_id,
            workspaces(name)
          )
        )
      )
    `)
    .ilike("file_name", searchPattern)
    .eq("tasks.archived", false)
    .limit(10);

  if (tasksWithAttachments) {
    const attachmentTaskIds = new Set(results.filter((r) => r.type === "task").map((r) => r.id));
    
    tasksWithAttachments.forEach((att) => {
      const task = att.tasks as unknown as {
        id: string;
        title: string;
        description: string | null;
        lists: {
          id: string;
          boards: {
            id: string;
            name: string;
            workspace_id: string;
            workspaces: { name: string };
          };
        };
      };

      // Only add if not already in results
      if (!attachmentTaskIds.has(task.id)) {
        attachmentTaskIds.add(task.id);
        results.push({
          type: "task" as const,
          id: task.id,
          title: task.title,
          description: task.description,
          workspaceId: task.lists.boards.workspace_id,
          workspaceName: task.lists.boards.workspaces?.name || "",
          boardId: task.lists.boards.id,
          boardName: task.lists.boards.name,
        });
      }
    });
  }

  return results;
}
