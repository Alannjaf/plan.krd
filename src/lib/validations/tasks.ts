import { z } from "zod";

/**
 * Validation schema for task creation
 */
export const createTaskSchema = z.object({
  listId: z.string().uuid("Invalid list ID"),
  title: z.string().min(1, "Title is required").max(500, "Title must be less than 500 characters"),
  description: z.string().max(10000, "Description must be less than 10000 characters").nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").nullable().optional(),
});

/**
 * Validation schema for task updates
 */
export const updateTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  title: z.string().min(1, "Title is required").max(500, "Title must be less than 500 characters").optional(),
  description: z.string().max(10000, "Description must be less than 10000 characters").nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").nullable().optional(),
});

/**
 * Validation schema for task movement
 */
export const moveTaskSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  targetListId: z.string().uuid("Invalid target list ID"),
  newPosition: z.number().int().min(0, "Position must be non-negative"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
