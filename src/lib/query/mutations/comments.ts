"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createComment, updateComment, deleteComment, type Comment } from "@/lib/actions/comments";
import { queryKeys } from "../queries/comments";

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      content,
      parentId,
    }: {
      taskId: string;
      content: string;
      parentId?: string;
    }) => {
      const result = await createComment(taskId, content, parentId);
      if (!result.success) {
        throw new Error(result.error || "Failed to create comment");
      }
      return result.comment!;
    },
    onMutate: async ({ taskId, content, parentId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments(taskId) });

      const previousComments = queryClient.getQueryData<Comment[]>(queryKeys.comments(taskId));

      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        task_id: taskId,
        parent_id: parentId || null,
        user_id: "",
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Comment[]>(queryKeys.comments(taskId), (old) => {
        if (!old) return [optimisticComment];
        if (parentId) {
          // Add as reply
          return old.map((comment) => {
            if (comment.id === parentId) {
              return {
                ...comment,
                replies: [...(comment.replies || []), optimisticComment],
              };
            }
            return comment;
          });
        }
        return [optimisticComment, ...old];
      });

      return { previousComments };
    },
    onError: (err, variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(queryKeys.comments(variables.taskId), context.previousComments);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(variables.taskId) });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const result = await updateComment(commentId, content);
      if (!result.success) {
        throw new Error(result.error || "Failed to update comment");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const result = await deleteComment(commentId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete comment");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
  });
}
