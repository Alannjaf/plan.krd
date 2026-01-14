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
          const newData = payload.new as AssigneePayload["new"] | null;
          const oldData = payload.old as { task_id?: string } | null;
          const taskId = (newData && "task_id" in newData ? newData.task_id : null) || 
                         (oldData && "task_id" in oldData ? oldData.task_id : null);
          if (taskId) {
            // Update task's assignees in cache instead of invalidating
            handleAssigneeChange(taskId);
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
            // Update task's labels in cache instead of invalidating
            handleLabelChange(taskId);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Fetch and update task assignees in cache
    async function handleAssigneeChange(taskId: string) {
      const tasks = queryClient.getQueryData<TaskWithRelations[]>(
        queryKeys.tasksByBoard(boardId)
      );
      if (!tasks?.some(t => t.id === taskId)) return;

      // Fetch updated assignees with profiles
      const { data: assigneesData, error } = await supabase
        .from("task_assignees")
        .select("id, user_id, profiles:profiles!task_assignees_user_id_fkey(id, email, full_name, avatar_url)")
        .eq("task_id", taskId);

      if (error) {
        console.error("Error fetching assignees:", error);
        return;
      }

      // Type for Supabase response (profiles might be array or object)
      type AssigneeResponse = {
        id: string;
        user_id: string;
        profiles: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
        } | {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
        }[] | null;
      };

      // Update cache with new assignees
      queryClient.setQueryData<TaskWithRelations[]>(
        queryKeys.tasksByBoard(boardId),
        (currentTasks) => {
          if (!currentTasks) return currentTasks;
          return currentTasks.map((task) => {
            if (task.id !== taskId) return task;
            
            const assignees = ((assigneesData as unknown as AssigneeResponse[] | null) || []).map((a) => {
              // Handle profiles which might be an object or array from Supabase
              const profileData = Array.isArray(a.profiles) 
                ? a.profiles[0] 
                : a.profiles;
              
              return {
                id: a.id,
                user_id: a.user_id,
                profiles: profileData || {
                  id: "",
                  email: null,
                  full_name: null,
                  avatar_url: null,
                },
              };
            });
            
            return {
              ...task,
              assignees,
            } as TaskWithRelations;
          });
        }
      );
    }

    // Fetch and update task labels in cache
    async function handleLabelChange(taskId: string) {
      const tasks = queryClient.getQueryData<TaskWithRelations[]>(
        queryKeys.tasksByBoard(boardId)
      );
      if (!tasks?.some(t => t.id === taskId)) return;

      // Fetch updated labels
      const { data: labelsData, error } = await supabase
        .from("task_labels")
        .select("id, label_id, labels(id, name, color)")
        .eq("task_id", taskId);

      if (error) {
        console.error("Error fetching labels:", error);
        return;
      }

      // Type for Supabase response (labels might be array or object)
      type LabelResponse = {
        id: string;
        label_id: string;
        labels: {
          id: string;
          name: string;
          color: string;
        } | {
          id: string;
          name: string;
          color: string;
        }[] | null;
      };

      // Update cache with new labels
      queryClient.setQueryData<TaskWithRelations[]>(
        queryKeys.tasksByBoard(boardId),
        (currentTasks) => {
          if (!currentTasks) return currentTasks;
          return currentTasks.map((task) => {
            if (task.id !== taskId) return task;
            
            const labels = ((labelsData as unknown as LabelResponse[] | null) || []).map((l) => {
              // Handle labels which might be an object or array from Supabase
              const labelData = Array.isArray(l.labels) 
                ? l.labels[0] 
                : l.labels;
              
              return {
                id: l.id,
                label_id: l.label_id,
                labels: labelData || {
                  id: "",
                  name: "",
                  color: "",
                },
              };
            });
            
            return {
              ...task,
              labels,
            } as TaskWithRelations;
          });
        }
      );
    }

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
