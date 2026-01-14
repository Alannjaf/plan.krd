import type { AIAction } from "@/lib/ai/prompts";

/**
 * Translate database/technical errors into user-friendly messages
 */
export function translateError(error: string, actionType: string): string {
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
 * Type exports for AI actions
 */
export type { AIAction };
