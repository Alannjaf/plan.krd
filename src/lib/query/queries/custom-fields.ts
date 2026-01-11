"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomFields, type CustomField } from "@/lib/actions/custom-fields";

export const queryKeys = {
  customFields: (boardId: string) => ["customFields", boardId] as const,
};

export function useCustomFields(boardId: string) {
  return useQuery({
    queryKey: queryKeys.customFields(boardId),
    queryFn: () => getCustomFields(boardId),
    enabled: !!boardId,
    staleTime: 5 * 60 * 1000, // 5 minutes - field definitions don't change often
  });
}
