"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  uploadAttachment,
  deleteAttachment,
  createAttachmentRecord,
  type Attachment,
} from "@/lib/actions/attachments";
import { queryKeys } from "../queries/attachments";

export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const result = await uploadAttachment(taskId, file);
      if (!result.success) {
        throw new Error(result.error || "Failed to upload attachment");
      }
      return result.attachment!;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments(variables.taskId) });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const result = await deleteAttachment(attachmentId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete attachment");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
    },
  });
}

export function useCreateAttachmentRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      fileInfo,
    }: {
      taskId: string;
      fileInfo: {
        file_name: string;
        file_path: string;
        file_type: string;
        file_size: number;
      };
    }) => {
      const result = await createAttachmentRecord(taskId, fileInfo);
      if (!result.success) {
        throw new Error(result.error || "Failed to create attachment record");
      }
      return result.attachment!;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments(variables.taskId) });
    },
  });
}
