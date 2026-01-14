import { z } from "zod";

/**
 * Validation schema for comment creation
 */
export const createCommentSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  content: z.string().min(1, "Comment cannot be empty").max(5000, "Comment must be less than 5000 characters"),
  parentId: z.string().uuid("Invalid parent comment ID").optional(),
});

/**
 * Validation schema for comment updates
 */
export const updateCommentSchema = z.object({
  commentId: z.string().uuid("Invalid comment ID"),
  content: z.string().min(1, "Comment cannot be empty").max(5000, "Comment must be less than 5000 characters"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
