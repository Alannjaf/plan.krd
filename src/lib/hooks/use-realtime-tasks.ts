"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/queries/tasks";
import type { TaskWithRelations } from "@/lib/actions/tasks";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TaskPayload = RealtimePostgresChangesPayload<{
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: "low" | "medium" | "high" | "urgent" | null;
  start_date: string | null;
  due_date: string | null;
  archived: boolean;
  archived_at: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}>;

type AssigneePayload = RealtimePostgresChangesPayload<{
  id: string;
  task_id: string;
  user_id: string;
}>;

type LabelPayload = RealtimePostgresChangesPayload<{
  id: string;
  task_id: string;
  label_id: string;
}>;

export function useRealtimeTasks(boardId: string, listIds: string[]) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!boardId || listIds.length === 0) return;

    const supabase = createClient();
    
    // Create a channel for this board's tasks
    const channel = supabase
      .channel(`board-tasks-${boardId}`)
      // Listen to task changes
      .on<TaskPayload["new"]>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          const taskData = payload.new as TaskPayload["new"];
          const oldData = payload.old as { id?: string; list_id?: string };

          // Only process if the task belongs to one of our lists
          const isRelevant = 
            (taskData && listIds.includes(taskData.list_id)) ||
            (oldData && oldData.list_id && listIds.includes(oldData.list_id));

          if (!isRelevant) return;

          handleTaskChange(payload.eventType, taskData, oldData);
        }
      )
      // Listen to assignee changes
      .on<AssigneePayload["new"]>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_assignees",
        },
        (payload) => {
          // Invalidate to refresh assignee data with profiles
          const taskId = (payload.new as AssigneePayload["new"])?.task_id || 
                         (payload.old as { task_id?: string })?.task_id;
          if (taskId) {
            // Check if this task is in our board
            const tasks = queryClient.getQueryData<TaskWithRelations[]>(
              queryKeys.tasksByBoard(boardId)
            );
            if (tasks?.some(t => t.id === taskId)) {
              queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard(boardId) });
            }
          }
        }
      )
      // Listen to label changes
      .on<LabelPayload["new"]>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_labels",
        },
        (payload) => {
          const taskId = (payload.new as LabelPayload["new"])?.task_id || 
                         (payload.old as { task_id?: string })?.task_id;
          if (taskId) {
            const tasks = queryClient.getQueryData<TaskWithRelations[]>(
              queryKeys.tasksByBoard(boardId)
            );
            if (tasks?.some(t => t.id === taskId)) {
              queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard(boardId) });
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    function handleTaskChange(
      eventType: string,
      newData: TaskPayload["new"],
      oldData: { id?: string; list_id?: string }
    ) {
      queryClient.setQueryData<TaskWithRelations[]>(
        queryKeys.tasksByBoard(boardId),
        (currentTasks) => {
          if (!currentTasks) return currentTasks;

          switch (eventType) {
            case "INSERT":
              // Check if task already exists (from optimistic update)
              if (newData && !currentTasks.some(t => t.id === newData.id)) {
                // Add new task with empty relations (will be populated on next fetch)
                const newTask: TaskWithRelations = {
                  ...newData,
                  assignees: [],
                  labels: [],
                  subtasks: [],
                  custom_field_values: [],
                  attachments_count: 0,
                  comments_count: 0,
                };
                return [...currentTasks, newTask];
              }
              return currentTasks;

            case "UPDATE":
              if (newData) {
                return currentTasks.map((task) =>
                  task.id === newData.id
                    ? { ...task, ...newData }
                    : task
                );
              }
              return currentTasks;

            case "DELETE":
              if (oldData?.id) {
                return currentTasks.filter((task) => task.id !== oldData.id);
              }
              return currentTasks;

            default:
              return currentTasks;
          }
        }
      );
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [boardId, listIds.join(","), queryClient]);
}
