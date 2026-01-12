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
} from "@/lib/ai/prompts";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type DecomposedSubtask = {
  title: string;
};

export type AutoTagSuggestion = {
  priority: "low" | "medium" | "high" | "urgent";
  labels: string[];
  reasoning: string;
};

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
): Promise<{ success: boolean; response?: string; error?: string }> {
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
  let contextData: {
    workspaceName?: string;
    boardName?: string;
    tasks?: Array<{
      id: string;
      title: string;
      description?: string | null;
      due_date?: string | null;
      priority?: string | null;
      status?: string;
      assignees?: string[];
    }>;
    userName?: string;
  } = {
    userName: profile?.full_name || profile?.email || undefined,
  };

  // If board context, get board tasks
  if (context.boardId) {
    const { data: board } = await supabase
      .from("boards")
      .select("name, workspace_id, workspaces(name)")
      .eq("id", context.boardId)
      .single();

    if (board) {
      contextData.boardName = board.name;
      // Handle workspaces as it can be an array or object from Supabase
      const workspaceData = board.workspaces;
      const workspace = Array.isArray(workspaceData) 
        ? workspaceData[0] as { name: string } | undefined
        : workspaceData as { name: string } | null;
      contextData.workspaceName = workspace?.name;
    }

    // Get tasks for the board
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
        list_id,
        lists!inner(name),
        task_assignees(
          profiles(full_name, email)
        )
      `)
      .eq("lists.board_id", context.boardId)
      .eq("archived", false)
      .limit(100);

    if (tasks) {
      contextData.tasks = tasks.map((t) => {
        // Handle lists - can be array or object from Supabase
        const listData = t.lists;
        const list = Array.isArray(listData) ? listData[0] : listData;
        const listName = (list as { name: string } | null)?.name || "unknown";
        
        // Handle task_assignees - get profiles from each assignee
        const assigneesList = t.task_assignees as Array<{ profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null }> | null;
        const assigneeNames = assigneesList
          ?.map((a) => {
            const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            return profile?.full_name || profile?.email || "";
          })
          .filter(Boolean) || [];

        return {
          id: t.id,
          title: t.title,
          description: t.description,
          due_date: t.due_date,
          priority: t.priority,
          status: t.completed ? "completed" : listName,
          assignees: assigneeNames,
        };
      });
    }
  } else if (context.workspaceId) {
    // Get workspace info
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", context.workspaceId)
      .single();

    if (workspace) {
      contextData.workspaceName = workspace.name;
    }

    // Get all tasks in workspace
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
        list_id,
        lists!inner(
          name,
          boards!inner(workspace_id)
        ),
        task_assignees(
          profiles(full_name, email)
        )
      `)
      .eq("lists.boards.workspace_id", context.workspaceId)
      .eq("archived", false)
      .limit(100);

    if (tasks) {
      contextData.tasks = tasks.map((t) => {
        // Handle lists - can be array or object from Supabase
        const listData = t.lists;
        const list = Array.isArray(listData) ? listData[0] : listData;
        const listName = (list as { name: string } | null)?.name || "unknown";
        
        // Handle task_assignees - get profiles from each assignee
        const assigneesList = t.task_assignees as Array<{ profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null }> | null;
        const assigneeNames = assigneesList
          ?.map((a) => {
            const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            return profile?.full_name || profile?.email || "";
          })
          .filter(Boolean) || [];

        return {
          id: t.id,
          title: t.title,
          description: t.description,
          due_date: t.due_date,
          priority: t.priority,
          status: t.completed ? "completed" : listName,
          assignees: assigneeNames,
        };
      });
    }
  }

  // Build messages for the AI
  const contextString = buildChatContext(contextData);
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

  const result = await chatCompletion(messages, { temperature: 0.7 });

  if (!result.success) {
    return { success: false, error: result.error };
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

  // Get the task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("title, description")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return { success: false, error: "Task not found" };
  }

  const userPrompt = buildDecomposePrompt(task);
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

  // Validate subtasks
  const validSubtasks = subtasks
    .filter((s) => s.title && typeof s.title === "string")
    .map((s) => ({ title: s.title.trim() }));

  if (validSubtasks.length === 0) {
    return { success: false, error: "No valid subtasks generated" };
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
 * Suggest labels and priority for a task
 */
export async function suggestTagsAndPriority(
  title: string,
  description: string | null,
  boardId: string
): Promise<{ success: boolean; suggestion?: AutoTagSuggestion; error?: string }> {
  const supabase = await createClient();

  // Get available labels for the board
  const { data: labels } = await supabase
    .from("labels")
    .select("name")
    .eq("board_id", boardId);

  const availableLabels = labels?.map((l) => l.name) || [];

  const userPrompt = buildAutoTagPrompt(
    { title, description },
    availableLabels
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

  return {
    success: true,
    suggestion: {
      priority: suggestion.priority || "medium",
      labels: validLabels,
      reasoning: suggestion.reasoning || "",
    },
  };
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
