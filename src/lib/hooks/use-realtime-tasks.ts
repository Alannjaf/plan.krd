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
          const taskData = payload.new as TaskPayload["new"] | null;
          const oldData = payload.old as { id?: string; list_id?: string } | null;

          // Only process if the task belongs to one of our lists
          const isRelevant = 
            (taskData && "list_id" in taskData && listIds.includes(taskData.list_id)) ||
            (oldData && "list_id" in oldData && oldData.list_id && listIds.includes(oldData.list_id));

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
          const newData = payload.new as AssigneePayload["new"] | null;
          const oldData = payload.old as { task_id?: string } | null;
          const taskId = (newData && "task_id" in newData ? newData.task_id : null) || 
                         (oldData && "task_id" in oldData ? oldData.task_id : null);
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
          const newData = payload.new as LabelPayload["new"] | null;
          const oldData = payload.old as { task_id?: string } | null;
          const taskId = (newData && "task_id" in newData ? newData.task_id : null) || 
                         (oldData && "task_id" in oldData ? oldData.task_id : null);
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
      newData: TaskPayload["new"] | null,
      oldData: { id?: string; list_id?: string } | null
    ) {
      queryClient.setQueryData<TaskWithRelations[]>(
        queryKeys.tasksByBoard(boardId),
        (currentTasks) => {
          if (!currentTasks) return currentTasks;

          switch (eventType) {
            case "INSERT":
              if (newData && "id" in newData && "list_id" in newData) {
                // Check if task already exists (avoid duplicates)
                if (currentTasks.some(t => t.id === newData.id)) {
                  return currentTasks;
                }

                // Check if there's an optimistic task (temp ID) in the same list that should be replaced
                // Optimistic tasks have IDs like "temp-1234567890"
                const optimisticTaskIndex = currentTasks.findIndex(
                  t => t.id.startsWith("temp-") && t.list_id === newData.list_id
                );

                // Create new task with empty relations (will be populated on next fetch)
                const newTask: TaskWithRelations = {
                  id: newData.id,
                  list_id: newData.list_id,
                  title: newData.title,
                  description: newData.description,
                  position: newData.position,
                  priority: newData.priority,
                  start_date: newData.start_date,
                  due_date: newData.due_date,
                  archived: newData.archived,
                  archived_at: newData.archived_at,
                  completed: newData.completed,
                  completed_at: newData.completed_at,
                  created_by: newData.created_by,
                  created_at: newData.created_at,
                  updated_at: newData.updated_at,
                  assignees: [],
                  labels: [],
                  subtasks: [],
                  custom_field_values: [],
                  attachments_count: 0,
                  comments_count: 0,
                };

                // Replace optimistic task if found, otherwise add new task
                if (optimisticTaskIndex !== -1) {
                  const updatedTasks = [...currentTasks];
                  updatedTasks[optimisticTaskIndex] = newTask;
                  return updatedTasks;
                }

                return [...currentTasks, newTask];
              }
              return currentTasks;

            case "UPDATE":
              if (newData && "id" in newData) {
                return currentTasks.map((task) =>
                  task.id === newData.id
                    ? { ...task, ...newData }
                    : task
                );
              }
              return currentTasks;

            case "DELETE":
              if (oldData && "id" in oldData && oldData.id) {
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
