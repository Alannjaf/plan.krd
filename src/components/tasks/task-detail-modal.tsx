"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TaskHeader } from "./task-header";
import { TaskDescription } from "./task-description";
import { TaskDates } from "./task-dates";
import { TaskPriority } from "./task-priority";
import { TaskAssignees } from "./task-assignees";
import { TaskLabels } from "./task-labels";
import { SubtaskList } from "./subtask-list";
import { AttachmentList } from "./attachment-list";
import { ActivityLog } from "./activity-log";
import { CommentSection } from "./comment-section";
import { CustomFields } from "./custom-fields";
import { useTask, queryKeys } from "@/lib/query/queries/tasks";
import { useDeleteTask, useArchiveTask, useUnarchiveTask } from "@/lib/query/mutations/tasks";
import { useRealtimeComments } from "@/lib/hooks/use-realtime-comments";
import type { TaskWithRelations } from "@/lib/actions/tasks";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, History, Paperclip, Trash2, Archive, ArchiveRestore, Share2 } from "lucide-react";
import { TaskShareDialog } from "./task-share-dialog";
import { AutoTagSuggestions } from "@/components/ai/auto-tag-suggestions";
import { useLabels } from "@/lib/query/queries/labels";
import { useUpdateTask } from "@/lib/query/mutations/tasks";
import { addLabelToTask } from "@/lib/actions/labels";
import { useWorkspaceMembers } from "@/lib/query/queries/members";
import { useCustomFields } from "@/lib/query/queries/custom-fields";
import { addAssignee } from "@/lib/actions/assignees";
import { setCustomFieldValue } from "@/lib/actions/custom-fields";

interface TaskDetailModalProps {
  taskId: string | null;
  boardId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
  readOnly?: boolean;
}

export function TaskDetailModal({
  taskId,
  boardId,
  workspaceId,
  open,
  onOpenChange,
  onTaskUpdated,
  readOnly = false,
}: TaskDetailModalProps) {
  const { data: taskFromQuery, isLoading: initialLoading } = useTask(taskId, boardId);
  const queryClient = useQueryClient();
  const deleteTaskMutation = useDeleteTask();
  const archiveTaskMutation = useArchiveTask();
  const unarchiveTaskMutation = useUnarchiveTask();
  const updateTaskMutation = useUpdateTask();
  const { data: boardLabels = [] } = useLabels(boardId);
  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const { data: customFields = [] } = useCustomFields(boardId);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("comments");
  const [commentsReady, setCommentsReady] = useState(false);
  const hasChanges = useRef(false);
  const realTaskIdRef = useRef<string | null>(null);

  // If taskId is a temp ID, try to get the task from board cache (optimistic)
  const isTempId = taskId?.startsWith("temp-") ?? false;
  const boardTasks = queryClient.getQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard(boardId));
  const optimisticTask = useMemo(() => {
    if (isTempId && taskId && boardTasks) {
      return boardTasks.find(t => t.id === taskId);
    }
    return null;
  }, [isTempId, boardTasks, taskId]);

  // Watch for when the real task arrives (realtime replaces temp task)
  useEffect(() => {
    if (isTempId && optimisticTask && boardTasks) {
      // Look for a task with the same title and list_id but with a real UUID
      const realTask = boardTasks.find(
        t => !t.id.startsWith("temp-") && 
        t.title === optimisticTask.title && 
        t.list_id === optimisticTask.list_id
      );
      if (realTask && realTask.id !== realTaskIdRef.current) {
        realTaskIdRef.current = realTask.id;
        // Update the query cache to use the real task
        queryClient.setQueryData(queryKeys.task(realTask.id), realTask);
      }
    }
  }, [isTempId, optimisticTask, boardTasks, queryClient]);

  // Use real task if available, otherwise use task from query or optimistic task
  const task = useMemo(() => {
    // If we have a real task ID, use it
    if (realTaskIdRef.current && boardTasks) {
      const realTask = boardTasks.find(t => t.id === realTaskIdRef.current);
      if (realTask) return realTask;
    }
    // Use task from query (for real IDs) or optimistic task (for temp IDs)
    return taskFromQuery || optimisticTask || null;
  }, [taskFromQuery, optimisticTask, boardTasks]);

  // Determine if we have a real task ID to use for operations
  const effectiveTaskId = realTaskIdRef.current || (isTempId ? null : taskId);

  // Subscribe to realtime comment updates when modal is open
  // Only subscribe if we have a real task ID
  useRealtimeComments(open && effectiveTaskId && commentsReady ? effectiveTaskId : "");

  // Defer comments loading until after task content is rendered
  // This makes the modal feel instant (shows task data first)
  useEffect(() => {
    if (open && task && !commentsReady) {
      // Small delay to let task content render first
      const timer = setTimeout(() => setCommentsReady(true), 100);
      return () => clearTimeout(timer);
    }
    if (!open) {
      setCommentsReady(false);
    }
  }, [open, task, commentsReady]);

  useEffect(() => {
    if (!open) {
      hasChanges.current = false;
    }
  }, [open]);

  // Handle modal close - sync with Kanban board
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasChanges.current) {
      onTaskUpdated?.();
    }
    onOpenChange(newOpen);
  };

  // Mark that changes were made (for syncing on close)
  const markChanged = () => {
    hasChanges.current = true;
  };

  const handleDelete = async () => {
    if (!task || !effectiveTaskId) return;
    try {
      await deleteTaskMutation.mutateAsync(effectiveTaskId);
      hasChanges.current = true;
      onTaskUpdated?.();
      onOpenChange(false);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleArchiveToggle = async () => {
    if (!task || !effectiveTaskId) return;
    try {
      if (task.archived) {
        await unarchiveTaskMutation.mutateAsync(effectiveTaskId);
      } else {
        await archiveTaskMutation.mutateAsync(effectiveTaskId);
        // If archiving, close the modal (task disappears from board)
        onTaskUpdated?.();
        onOpenChange(false);
      }
      hasChanges.current = true;
    } catch (error) {
      console.error("Failed to toggle archive:", error);
    }
  };

  if (!taskId) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>{task?.title || "Task Details"}</DialogTitle>
          <DialogDescription>
            View and edit task details, comments, attachments, and activity
          </DialogDescription>
        </VisuallyHidden>
        {initialLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogHeader className="p-6 pb-0 shrink-0">
              <TaskHeader
                task={task}
                onChanged={markChanged}
                readOnly={readOnly}
              />
            </DialogHeader>

            <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 min-w-0 border-r border-border/50 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-6">
                      {/* Description */}
                      <TaskDescription
                        task={task}
                        onChanged={markChanged}
                        readOnly={readOnly}
                        realTaskId={effectiveTaskId}
                      />

                      {/* Subtasks */}
                      <SubtaskList
                        task={task}
                        workspaceId={workspaceId}
                        onChanged={markChanged}
                        readOnly={readOnly}
                      />

                      {/* Tabs for Comments, Activity, Attachments - Lazy loaded */}
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col min-h-0 max-h-[calc(85vh-400px)]">
                        <TabsList className="w-full justify-start shrink-0" role="tablist" aria-label="Task details tabs">
                          <TabsTrigger value="comments" className="gap-2" role="tab" aria-label={`Comments${task.comments_count > 0 ? `, ${task.comments_count} comments` : ""}`}>
                            <MessageSquare className="h-4 w-4" aria-hidden="true" />
                            Comments
                            {task.comments_count > 0 && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded" aria-label={`${task.comments_count} comments`}>
                                {task.comments_count}
                              </span>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="attachments" className="gap-2" role="tab" aria-label={`Attachments${task.attachments_count > 0 ? `, ${task.attachments_count} attachments` : ""}`}>
                            <Paperclip className="h-4 w-4" aria-hidden="true" />
                            Attachments
                            {task.attachments_count > 0 && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded" aria-label={`${task.attachments_count} attachments`}>
                                {task.attachments_count}
                              </span>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="activity" className="gap-2" role="tab" aria-label="Activity log">
                            <History className="h-4 w-4" aria-hidden="true" />
                            Activity
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="comments" className="mt-4 flex-1 min-h-0 flex flex-col">
                          {activeTab === "comments" && commentsReady ? (
                            <CommentSection
                              taskId={task.id}
                              workspaceId={workspaceId}
                              readOnly={readOnly}
                            />
                          ) : activeTab === "comments" ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : null}
                        </TabsContent>
                        <TabsContent value="attachments" className="mt-4">
                          {activeTab === "attachments" && (
                            <AttachmentList
                              task={task}
                              onChanged={markChanged}
                            />
                          )}
                        </TabsContent>
                        <TabsContent value="activity" className="mt-4">
                          {activeTab === "activity" && (
                            <ActivityLog taskId={task.id} />
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </ScrollArea>
                </div>

                {/* Sidebar */}
                <div className="w-80 shrink-0 bg-secondary/20 relative">
                  <div className="absolute inset-0 overflow-y-auto">
                    <div className="p-4 pb-8 space-y-5">
                      {/* Assignees */}
                      <TaskAssignees
                        task={task}
                        workspaceId={workspaceId}
                        boardId={boardId}
                        onChanged={markChanged}
                        readOnly={readOnly}
                      />

                      {/* Labels */}
                      <TaskLabels
                        task={task}
                        boardId={boardId}
                        onChanged={markChanged}
                        readOnly={readOnly}
                      />

                      {/* Dates */}
                      <TaskDates
                        task={task}
                        onChanged={markChanged}
                        readOnly={readOnly}
                      />

                      {/* Priority */}
                      <TaskPriority
                        task={task}
                        onChanged={markChanged}
                        readOnly={readOnly}
                      />

                      {/* Custom Fields */}
                      <CustomFields
                        task={task}
                        boardId={boardId}
                        onChanged={markChanged}
                        readOnly={readOnly}
                      />

                      {/* AI Suggestions */}
                      {!readOnly && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted-foreground">
                            AI Assist
                          </div>
                          <AutoTagSuggestions
                            title={task.title}
                            description={task.description}
                            boardId={boardId}
                            listId={task.list_id}
                            currentPriority={task.priority}
                            currentLabels={task.labels?.map((l) => l.labels?.name || "") || []}
                            currentLabelIds={task.labels?.map((l) => l.label_id) || []}
                            currentDueDate={task.due_date}
                            currentAssignees={task.assignees?.map((a) => a.user_id) || []}
                            workspaceMembers={workspaceMembers.map((m) => ({
                              id: m.user_id,
                              name:
                                (m.profiles as { full_name?: string; email?: string })?.full_name ||
                                (m.profiles as { email?: string })?.email ||
                                "Unknown",
                              email: (m.profiles as { email?: string })?.email || null,
                            }))}
                            customFields={customFields}
                            onApplyPriority={(priority) => {
                              markChanged();
                              updateTaskMutation.mutate({
                                taskId: task.id,
                                updates: { priority },
                              });
                            }}
                            onApplyLabel={async (labelName) => {
                              const label = boardLabels.find(
                                (l) => l.name.toLowerCase() === labelName.toLowerCase()
                              );
                              if (!label) return;

                              markChanged();

                              // Cancel outgoing queries
                              await queryClient.cancelQueries({ queryKey: queryKeys.task(task.id) });

                              // Snapshot previous state
                              const previousTask = queryClient.getQueryData<TaskWithRelations>(
                                queryKeys.task(task.id)
                              );

                              // Optimistically update cache
                              queryClient.setQueryData<TaskWithRelations>(
                                queryKeys.task(task.id),
                                (old) => {
                                  if (!old) return old;
                                  // Check if label already exists
                                  const labelExists = old.labels?.some(
                                    (l) => l.label_id === label.id
                                  );
                                  if (labelExists) return old;

                                  // Add optimistic label
                                  const optimisticLabel = {
                                    id: `temp-${Date.now()}`,
                                    label_id: label.id,
                                    labels: {
                                      id: label.id,
                                      name: label.name,
                                      color: label.color,
                                    },
                                  };

                                  return {
                                    ...old,
                                    labels: [...(old.labels || []), optimisticLabel],
                                  };
                                }
                              );

                              try {
                                const result = await addLabelToTask(task.id, label.id);
                                if (!result.success) {
                                  throw new Error(result.error || "Failed to add label");
                                }
                                // Refetch to get real data
                                queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
                              } catch (error) {
                                // Rollback on error
                                if (previousTask) {
                                  queryClient.setQueryData(queryKeys.task(task.id), previousTask);
                                }
                                console.error("Failed to add label:", error);
                              }
                            }}
                            onApplyAssignee={async (userId) => {
                              markChanged();

                              // Cancel outgoing queries
                              await queryClient.cancelQueries({ queryKey: queryKeys.task(task.id) });

                              // Snapshot previous state
                              const previousTask = queryClient.getQueryData<TaskWithRelations>(
                                queryKeys.task(task.id)
                              );

                              // Get user profile for optimistic update
                              const member = workspaceMembers.find((m) => m.user_id === userId);
                              if (!member) return;

                              const profile = Array.isArray(member.profiles)
                                ? member.profiles[0]
                                : member.profiles;

                              // Optimistically update cache
                              queryClient.setQueryData<TaskWithRelations>(
                                queryKeys.task(task.id),
                                (old) => {
                                  if (!old) return old;
                                  // Check if assignee already exists
                                  const assigneeExists = old.assignees?.some(
                                    (a) => a.user_id === userId
                                  );
                                  if (assigneeExists) return old;

                                  // Add optimistic assignee
                                  const optimisticAssignee = {
                                    id: `temp-${Date.now()}`,
                                    user_id: userId,
                                    profiles: {
                                      id: userId,
                                      email: (profile as { email?: string })?.email || null,
                                      full_name:
                                        (profile as { full_name?: string })?.full_name ||
                                        (profile as { email?: string })?.email ||
                                        null,
                                      avatar_url:
                                        (profile as { avatar_url?: string })?.avatar_url || null,
                                    },
                                  };

                                  return {
                                    ...old,
                                    assignees: [...(old.assignees || []), optimisticAssignee],
                                  };
                                }
                              );

                              try {
                                const result = await addAssignee(task.id, userId);
                                if (!result.success) {
                                  throw new Error(result.error || "Failed to add assignee");
                                }
                                // Refetch to get real data
                                queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
                              } catch (error) {
                                // Rollback on error
                                if (previousTask) {
                                  queryClient.setQueryData(queryKeys.task(task.id), previousTask);
                                }
                                console.error("Failed to add assignee:", error);
                              }
                            }}
                            onApplyDueDate={(dueDate) => {
                              markChanged();
                              updateTaskMutation.mutate({
                                taskId: task.id,
                                updates: { due_date: dueDate },
                              });
                            }}
                            onApplyCustomField={async (fieldId, value) => {
                              markChanged();

                              // Cancel outgoing queries
                              await queryClient.cancelQueries({ queryKey: queryKeys.task(task.id) });

                              // Snapshot previous state
                              const previousTask = queryClient.getQueryData<TaskWithRelations>(
                                queryKeys.task(task.id)
                              );

                              // Get custom field info
                              const field = customFields.find((f) => f.id === fieldId);
                              if (!field) return;

                              // Optimistically update cache
                              queryClient.setQueryData<TaskWithRelations>(
                                queryKeys.task(task.id),
                                (old) => {
                                  if (!old) return old;

                                  // Update or add custom field value
                                  const existingValueIndex = old.custom_field_values?.findIndex(
                                    (cfv) => cfv.field_id === fieldId
                                  );

                                  const optimisticValue = {
                                    id: `temp-${Date.now()}`,
                                    field_id: fieldId,
                                    value,
                                    custom_field: {
                                      id: field.id,
                                      name: field.name,
                                      field_type: field.field_type as "text" | "number" | "dropdown",
                                      options: field.options || [],
                                      required: field.required,
                                      position: field.position,
                                    },
                                  };

                                  let newCustomFieldValues: typeof old.custom_field_values;
                                  if (existingValueIndex !== undefined && existingValueIndex >= 0) {
                                    // Update existing
                                    newCustomFieldValues = [...(old.custom_field_values || [])];
                                    newCustomFieldValues[existingValueIndex] = optimisticValue;
                                  } else {
                                    // Add new
                                    newCustomFieldValues = [
                                      ...(old.custom_field_values || []),
                                      optimisticValue,
                                    ];
                                  }

                                  return {
                                    ...old,
                                    custom_field_values: newCustomFieldValues,
                                  };
                                }
                              );

                              try {
                                const result = await setCustomFieldValue(task.id, fieldId, value);
                                if (!result.success) {
                                  throw new Error(result.error || "Failed to set custom field");
                                }
                                // Refetch to get real data
                                queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
                              } catch (error) {
                                // Rollback on error
                                if (previousTask) {
                                  queryClient.setQueryData(queryKeys.task(task.id), previousTask);
                                }
                                console.error("Failed to set custom field:", error);
                              }
                            }}
                          />
                        </div>
                      )}

                      {/* Actions */}
                      {!readOnly && (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-2">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => setShowShareDialog(true)}
                              disabled={!taskId || taskId.startsWith("temp-")}
                            >
                              <Share2 className="mr-2 h-4 w-4" />
                              Share Task
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={handleArchiveToggle}
                              disabled={archiveTaskMutation.isPending || unarchiveTaskMutation.isPending}
                            >
                              {task.archived ? (
                                <>
                                  <ArchiveRestore className="mr-2 h-4 w-4" />
                                  {unarchiveTaskMutation.isPending ? "Restoring..." : "Restore from Archive"}
                                </>
                              ) : (
                                <>
                                  <Archive className="mr-2 h-4 w-4" />
                                  {archiveTaskMutation.isPending ? "Archiving..." : "Archive Task"}
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setShowDeleteDialog(true)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Task
                            </Button>
                          </div>
                          </>
                      )}
                    </div>
                  </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            Task not found
          </div>
        )}

        {/* Share Dialog */}
        {taskId && !taskId.startsWith("temp-") && (
          <TaskShareDialog
            taskId={taskId}
            open={showShareDialog}
            onOpenChange={setShowShareDialog}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{task?.title}&quot;? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteTaskMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteTaskMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
