"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { getTask, type TaskWithRelations } from "@/lib/actions/tasks";
import { Loader2, MessageSquare, History, Paperclip } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (taskId && open) {
      loadTask();
    } else {
      setTask(null);
    }
  }, [taskId, open]);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    const data = await getTask(taskId);
    setTask(data);
    setLoading(false);
  };

  const handleTaskUpdate = () => {
    loadTask();
    onTaskUpdated?.();
  };

  if (!taskId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{task?.title || "Task Details"}</DialogTitle>
        </VisuallyHidden>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 pb-0 shrink-0">
              <TaskHeader
                task={task}
                onUpdate={handleTaskUpdate}
                onClose={() => onOpenChange(false)}
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
                        taskId={task.id}
                        description={task.description}
                        onUpdate={handleTaskUpdate}
                      />

                      {/* Subtasks */}
                      <SubtaskList
                        taskId={task.id}
                        subtasks={task.subtasks}
                        onUpdate={handleTaskUpdate}
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
                            onUpdate={handleTaskUpdate}
                          />
                        </TabsContent>
                        <TabsContent value="attachments" className="mt-4">
                          <AttachmentList
                            taskId={task.id}
                            onUpdate={handleTaskUpdate}
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
                        taskId={task.id}
                        workspaceId={workspaceId}
                        assignees={task.assignees}
                        onUpdate={handleTaskUpdate}
                      />

                      {/* Labels */}
                      <TaskLabels
                        taskId={task.id}
                        boardId={boardId}
                        labels={task.labels}
                        onUpdate={handleTaskUpdate}
                      />

                      {/* Dates */}
                      <TaskDates
                        taskId={task.id}
                        startDate={task.start_date}
                        dueDate={task.due_date}
                        onUpdate={handleTaskUpdate}
                      />

                      {/* Priority */}
                      <TaskPriority
                        taskId={task.id}
                        priority={task.priority}
                        onUpdate={handleTaskUpdate}
                      />
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
      </DialogContent>
    </Dialog>
  );
}
