"use client";

import { useQuery } from "@tanstack/react-query";
import { getAttachments, type Attachment } from "@/lib/actions/attachments";

export const queryKeys = {
  attachments: (taskId: string) => ["attachments", taskId] as const,
};

export function useAttachments(taskId: string) {
  return useQuery({
    queryKey: queryKeys.attachments(taskId),
    queryFn: () => getAttachments(taskId),
    enabled: !!taskId,
  });
}
