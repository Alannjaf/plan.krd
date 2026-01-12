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
  type AIAction,
  type ChatContext,
} from "@/lib/ai/prompts";
import { createTask, updateTask, deleteTask, moveTask, completeTask, uncompleteTask } from "./tasks";
import { addAssignee, removeAssignee } from "./assignees";
import { addLabelToTask, removeLabelFromTask } from "./labels";

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

  // Check if the response is an action
  const action = parseAIAction(result.content || "");
  
  if (action) {
    console.log("[AI Chat] Action detected:", action);
    const actionResult = await executeAIAction(action, context);
    return {
      success: actionResult.success,
      response: actionResult.message,
      actionExecuted: actionResult.actionExecuted,
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
