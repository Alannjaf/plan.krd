"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createComment, updateComment, deleteComment, type Comment } from "@/lib/actions/comments";
import { queryKeys } from "../queries/comments";
import { showError, showSuccess } from "@/lib/utils/errors";

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
      showError(err, "Failed to create comment");
      if (context?.previousComments) {
        queryClient.setQueryData(queryKeys.comments(variables.taskId), context.previousComments);
      }
    },
    onSuccess: (data, variables) => {
      showSuccess("Comment added");
      // Replace optimistic comment with real comment from server
      queryClient.setQueryData<Comment[]>(queryKeys.comments(variables.taskId), (old) => {
        if (!old) return [data];
        
        // Find and replace the optimistic comment (temp-*) with the real one
        const hasOptimistic = old.some(c => c.id.startsWith("temp-"));
        if (hasOptimistic) {
          // Remove optimistic comment and add real one
          const filtered = old.filter(c => !c.id.startsWith("temp-"));
          return [data, ...filtered];
        }
        
        // If no optimistic comment found, just add the new one
        return [data, ...old];
      });
      
      // Note: Realtime subscriptions handle live updates, no need to invalidate
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, content, taskId }: { commentId: string; content: string; taskId: string }) => {
      const result = await updateComment(commentId, content);
      if (!result.success) {
        throw new Error(result.error || "Failed to update comment");
      }
      return { commentId, content };
    },
    onMutate: async ({ commentId, content, taskId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments(taskId) });
      
      const previousComments = queryClient.getQueryData<Comment[]>(queryKeys.comments(taskId));
      
      // Optimistically update the comment
      queryClient.setQueryData<Comment[]>(queryKeys.comments(taskId), (old) => {
        if (!old) return old;
        
        const updateCommentInTree = (comments: Comment[]): Comment[] => {
          return comments.map((comment) => {
            if (comment.id === commentId) {
              return { ...comment, content, updated_at: new Date().toISOString() };
            }
            if (comment.replies && comment.replies.length > 0) {
              return { ...comment, replies: updateCommentInTree(comment.replies) };
            }
            return comment;
          });
        };
        
        return updateCommentInTree(old);
      });
      
      return { previousComments };
    },
    onSuccess: () => {
      showSuccess("Comment updated");
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to update comment");
      if (context?.previousComments) {
        queryClient.setQueryData(queryKeys.comments(variables.taskId), context.previousComments);
      }
    },
    // Note: Realtime subscriptions handle live updates, no need to invalidate
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, taskId }: { commentId: string; taskId: string }) => {
      const result = await deleteComment(commentId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete comment");
      }
      return { commentId };
    },
    onMutate: async ({ commentId, taskId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments(taskId) });
      
      const previousComments = queryClient.getQueryData<Comment[]>(queryKeys.comments(taskId));
      
      // Optimistically remove the comment
      queryClient.setQueryData<Comment[]>(queryKeys.comments(taskId), (old) => {
        if (!old) return old;
        
        const removeCommentFromTree = (comments: Comment[]): Comment[] => {
          return comments
            .filter((comment) => comment.id !== commentId)
            .map((comment) => {
              if (comment.replies && comment.replies.length > 0) {
                return { ...comment, replies: removeCommentFromTree(comment.replies) };
              }
              return comment;
            });
        };
        
        return removeCommentFromTree(old);
      });
      
      return { previousComments };
    },
    onSuccess: () => {
      showSuccess("Comment deleted");
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to delete comment");
      if (context?.previousComments) {
        queryClient.setQueryData(queryKeys.comments(variables.taskId), context.previousComments);
      }
    },
    // Note: Realtime subscriptions handle live updates, no need to invalidate
  });
}
