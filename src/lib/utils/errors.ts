"use client";

import { toast } from "sonner";

/**
 * Standardized result type for server actions
 * All server actions should return this type for consistent error handling
 */
export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Create a success result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create an error result
 */
export function failure(error: string): Result<never> {
  return { success: false, error };
}

/**
 * Show error toast notification
 */
export function showError(error: string | Error | unknown, title?: string): void {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "An unexpected error occurred";
  toast.error(title || "Error", {
    description: message,
    duration: 5000,
  });
}

/**
 * Show success toast notification
 */
export function showSuccess(message: string, title?: string): void {
  toast.success(title || "Success", {
    description: message,
    duration: 3000,
  });
}

/**
 * Show info toast notification
 */
export function showInfo(message: string, title?: string): void {
  toast.info(title || "Info", {
    description: message,
    duration: 3000,
  });
}

/**
 * Show warning toast notification
 */
export function showWarning(message: string, title?: string): void {
  toast.warning(title || "Warning", {
    description: message,
    duration: 4000,
  });
}

/**
 * Handle server action result and show appropriate toast
 */
export function handleActionResult<T>(result: Result<T>, successMessage?: string): result is { success: true; data: T } {
  if (result.success) {
    if (successMessage) {
      showSuccess(successMessage);
    }
    return true;
  } else {
    showError(result.error || "Operation failed");
    return false;
  }
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unexpected error occurred";
}
