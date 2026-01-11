"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { getTask, deleteTask, archiveTask, unarchiveTask, type TaskWithRelations } from "@/lib/actions/tasks";
import { Loader2, MessageSquare, History, Paperclip, Trash2, Archive, ArchiveRestore } from "lucide-react";

interface TaskDetailModalProps {
  taskId: string | null;
  boardId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

export function TaskDetailModal({
  taskId,
  boardId,
  workspaceId,
  open,
  onOpenChange,
  onTaskUpdated,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const hasChanges = useRef(false);

  useEffect(() => {
    if (taskId && open) {
      loadTask();
    } else {
      setTask(null);
      hasChanges.current = false;
    }
  }, [taskId, open]);

  const loadTask = async () => {
    if (!taskId) return;
    setInitialLoading(true);
    const data = await getTask(taskId);
    setTask(data);
    setInitialLoading(false);
  };

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
    setIsDeleting(true);
    const result = await deleteTask(task.id);
    if (result.success) {
      hasChanges.current = true;
      onTaskUpdated?.();
      onOpenChange(false);
    }
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  const handleArchiveToggle = async () => {
    if (!task) return;
    setIsArchiving(true);
    
    const result = task.archived
      ? await unarchiveTask(task.id)
      : await archiveTask(task.id);

    if (result.success) {
      // Update local state
      setTask((prev) =>
        prev
          ? {
              ...prev,
              archived: !prev.archived,
              archived_at: prev.archived ? null : new Date().toISOString(),
            }
          : prev
      );
      hasChanges.current = true;
      
      // If archiving, close the modal (task disappears from board)
      if (!task.archived) {
        onTaskUpdated?.();
        onOpenChange(false);
      }
    }
    setIsArchiving(false);
  };

  if (!taskId) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <VisuallyHidden>
          <DialogTitle>{task?.title || "Task Details"}</DialogTitle>
        </VisuallyHidden>
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 pb-0 shrink-0">
              <TaskHeader
                task={task}
                setTask={setTask}
                onChanged={markChanged}
              />
            </DialogHeader>

            <div className="flex-1 overflow-hidden">
              <div className="flex h-full">
                {/* Main Content */}
                <div className="flex-1 min-w-0 border-r border-border/50">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-6">
                      {/* Description */}
                      <TaskDescription
                        task={task}
                        setTask={setTask}
                        onChanged={markChanged}
                      />

                      {/* Subtasks */}
                      <SubtaskList
                        task={task}
                        workspaceId={workspaceId}
                        setTask={setTask}
                        onChanged={markChanged}
                      />

                      {/* Tabs for Comments, Activity, Attachments */}
                      <Tabs defaultValue="comments" className="w-full">
                        <TabsList className="w-full justify-start">
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
                        <TabsContent value="comments" className="mt-4">
                          <CommentSection
                            taskId={task.id}
                            workspaceId={workspaceId}
                          />
                        </TabsContent>
                        <TabsContent value="attachments" className="mt-4">
                          <AttachmentList
                            task={task}
                            setTask={setTask}
                            onChanged={markChanged}
                          />
                        </TabsContent>
                        <TabsContent value="activity" className="mt-4">
                          <ActivityLog taskId={task.id} />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </ScrollArea>
                </div>

                {/* Sidebar */}
                <div className="w-80 shrink-0 bg-secondary/20">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-5">
                      {/* Assignees */}
                      <TaskAssignees
                        task={task}
                        setTask={setTask}
                        workspaceId={workspaceId}
                        onChanged={markChanged}
                      />

                      {/* Labels */}
                      <TaskLabels
                        task={task}
                        setTask={setTask}
                        boardId={boardId}
                        onChanged={markChanged}
                      />

                      {/* Dates */}
                      <TaskDates
                        task={task}
                        setTask={setTask}
                        onChanged={markChanged}
                      />

                      {/* Priority */}
                      <TaskPriority
                        task={task}
                        setTask={setTask}
                        onChanged={markChanged}
                      />

                      {/* Custom Fields */}
                      <CustomFields
                        task={task}
                        boardId={boardId}
                        setTask={setTask}
                        onChanged={markChanged}
                      />

                      {/* Actions */}
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={handleArchiveToggle}
                          disabled={isArchiving}
                        >
                          {task.archived ? (
                            <>
                              <ArchiveRestore className="mr-2 h-4 w-4" />
                              {isArchiving ? "Restoring..." : "Restore from Archive"}
                            </>
                          ) : (
                            <>
                              <Archive className="mr-2 h-4 w-4" />
                              {isArchiving ? "Archiving..." : "Archive Task"}
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
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
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
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
