"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/queries/comments";
import type { Comment } from "@/lib/actions/comments";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type CommentPayload = RealtimePostgresChangesPayload<{
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}>;

export function useRealtimeComments(taskId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on<CommentPayload["new"]>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const eventType = payload.eventType;
          const newData = payload.new as CommentPayload["new"];
          const oldData = payload.old as { id?: string };

          // For any comment change, invalidate to get fresh data with profiles
          // This is simpler than trying to maintain profile data locally
          queryClient.invalidateQueries({ queryKey: queryKeys.comments(taskId) });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [taskId, queryClient]);
}
