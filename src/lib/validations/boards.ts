import { z } from "zod";

/**
 * Validation schema for board creation
 */
export const createBoardSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  name: z.string().min(1, "Board name is required").max(100, "Board name must be less than 100 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
});

/**
 * Validation schema for board updates
 */
export const updateBoardSchema = z.object({
  boardId: z.string().uuid("Invalid board ID"),
  name: z.string().min(1, "Board name is required").max(100, "Board name must be less than 100 characters").optional(),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
