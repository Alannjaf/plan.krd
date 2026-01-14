"use server";

import { translateError } from "./utils";
import type { AIAction } from "./utils";
import { createTask, updateTask, deleteTask, moveTask, completeTask, uncompleteTask } from "../tasks";
import { addAssignee, removeAssignee } from "../assignees";
import { addLabelToTask, removeLabelFromTask } from "../labels";
import { logger } from "@/lib/utils/logger";

/**
 * Execute an AI action and return a human-readable response
 */
export async function executeAIAction(
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
    logger.error("Error executing AI action", error, { action: action.action, params: action.params });
    const errorMessage = (error instanceof Error ? error.message : "An unexpected error occurred");
    return { success: false, message: `❌ ${translateError(errorMessage, action.action)}` };
  }
}
