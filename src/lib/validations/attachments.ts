import { z } from "zod";

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Allowed file types for attachments
 */
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/**
 * Validation schema for file uploads
 */
export const uploadAttachmentSchema = z.object({
  taskId: z.string().uuid("Invalid task ID"),
  file: z
    .instanceof(File, { message: "Invalid file" })
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    })
    .refine((file) => ALLOWED_FILE_TYPES.includes(file.type), {
      message: "File type not allowed",
    }),
});

export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "File type not allowed. Allowed types: images, PDF, Office documents, text files",
    };
  }

  return { valid: true };
}
