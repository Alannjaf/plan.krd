"use client";

import { useState, useEffect, useRef } from "react";
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
import { useTask } from "@/lib/query/queries/tasks";
import { useDeleteTask, useArchiveTask, useUnarchiveTask } from "@/lib/query/mutations/tasks";
import { useRealtimeComments } from "@/lib/hooks/use-realtime-comments";
import type { TaskWithRelations } from "@/lib/actions/tasks";
import { Loader2, MessageSquare, History, Paperclip, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { AutoTagSuggestions } from "@/components/ai/auto-tag-suggestions";
import { useLabels } from "@/lib/query/queries/labels";
import { useUpdateTask } from "@/lib/query/mutations/tasks";
import { addLabelToTask } from "@/lib/actions/labels";

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
  const { data: task, isLoading: initialLoading } = useTask(taskId, boardId);
  const deleteTaskMutation = useDeleteTask();
  const archiveTaskMutation = useArchiveTask();
  const unarchiveTaskMutation = useUnarchiveTask();
  const updateTaskMutation = useUpdateTask();
  const { data: boardLabels = [] } = useLabels(boardId);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("comments");
  const [commentsReady, setCommentsReady] = useState(false);
  const hasChanges = useRef(false);

  // Subscribe to realtime comment updates when modal is open
  useRealtimeComments(open && taskId && commentsReady ? taskId : "");

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
    if (!task) return;
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      hasChanges.current = true;
      onTaskUpdated?.();
      onOpenChange(false);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleArchiveToggle = async () => {
    if (!task) return;
    try {
      if (task.archived) {
        await unarchiveTaskMutation.mutateAsync(task.id);
      } else {
        await archiveTaskMutation.mutateAsync(task.id);
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
                        <TabsList className="w-full justify-start shrink-0">
                          <TabsTrigger value="comments" className="gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Comments
                            {task.comments_count > 0 && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {task.comments_count}
                              </span>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="attachments" className="gap-2">
                            <Paperclip className="h-4 w-4" />
                            Attachments
                            {task.attachments_count > 0 && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {task.attachments_count}
                              </span>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="activity" className="gap-2">
                            <History className="h-4 w-4" />
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
                            currentPriority={task.priority}
                            currentLabels={task.labels?.map((l) => l.labels?.name || "") || []}
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
                              if (label) {
                                markChanged();
                                await addLabelToTask(task.id, label.id);
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
