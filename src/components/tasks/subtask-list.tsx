"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceMembers } from "@/lib/query/queries/members";
import {
  useCreateSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  useToggleSubtask,
} from "@/lib/query/mutations/subtasks";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { format, isPast, isToday } from "date-fns";
import { CheckSquare, Plus, Trash2, GripVertical, CalendarIcon, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskDecomposer } from "@/components/ai/task-decomposer";

interface SubtaskListProps {
  task: TaskWithRelations;
  workspaceId: string;
  onChanged: () => void;
  readOnly?: boolean;
}

type WorkspaceMember = {
  user_id: string;
  role: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

// Local type matching TaskWithRelations.subtasks
type SubtaskItem = {
  id: string;
  title: string;
  completed: boolean;
  position: number;
  due_date: string | null;
  assignee_id: string | null;
  assignee?: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function SubtaskList({ task, workspaceId, onChanged, readOnly = false }: SubtaskListProps) {
  const [newSubtask, setNewSubtask] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  const { data: membersData = [] } = useWorkspaceMembers(workspaceId);
  const members = membersData as unknown as WorkspaceMember[];
  
  const createSubtaskMutation = useCreateSubtask();
  const updateSubtaskMutation = useUpdateSubtask();
  const deleteSubtaskMutation = useDeleteSubtask();
  const toggleSubtaskMutation = useToggleSubtask();

  const subtasks = task.subtasks || [];

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  const completedCount = subtasks.filter((s) => s.completed).length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || readOnly) return;

    const title = newSubtask.trim();
    setNewSubtask("");

    try {
      await createSubtaskMutation.mutateAsync({ taskId: task.id, title });
      onChanged();
    } catch (error) {
      // Error is handled by React Query
      // Restore subtask on error
      setNewSubtask(title);
    }
  };

  const handleToggle = async (subtask: SubtaskItem) => {
    if (readOnly) return;
    const newCompleted = !subtask.completed;
    
    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    
    try {
      await toggleSubtaskMutation.mutateAsync({
        subtaskId: subtask.id,
        completed: newCompleted,
        taskId: task.id,
      });
      onChanged();
    } catch (error) {
      // Error is handled by React Query
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(subtask.id);
        return next;
      });
    }
  };

  const handleDelete = async (subtask: SubtaskItem) => {
    if (readOnly) return;
    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    
    try {
      await deleteSubtaskMutation.mutateAsync({ subtaskId: subtask.id, taskId: task.id });
      onChanged();
    } catch (error) {
      // Error is handled by React Query
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(subtask.id);
        return next;
      });
    }
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editingTitle.trim() || readOnly) return;

    const title = editingTitle.trim();
    setProcessingIds((prev) => new Set(prev).add(subtaskId));
    
    try {
      await updateSubtaskMutation.mutateAsync({
        subtaskId,
        updates: { title },
        taskId: task.id,
      });
      setEditingId(null);
      setEditingTitle("");
      onChanged();
    } catch (error) {
      // Error is handled by React Query
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(subtaskId);
        return next;
      });
    }
  };

  const handleDueDateChange = async (subtask: SubtaskItem, date: Date | undefined) => {
    if (readOnly) return;
    const newDate = date ? format(date, "yyyy-MM-dd") : null;

    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    
    try {
      await updateSubtaskMutation.mutateAsync({
        subtaskId: subtask.id,
        updates: { due_date: newDate },
        taskId: task.id,
      });
      onChanged();
    } catch (error) {
      // Error is handled by React Query
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(subtask.id);
        return next;
      });
    }
  };

  const handleAssigneeChange = async (subtask: SubtaskItem, member: WorkspaceMember | null) => {
    if (readOnly) return;
    const newAssigneeId = member?.user_id || null;
    const assigneeProfile = member?.profiles
      ? {
          id: member.profiles.id,
          email: member.profiles.email,
          full_name: member.profiles.full_name,
          avatar_url: member.profiles.avatar_url,
        }
      : null;

    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    
    try {
      await updateSubtaskMutation.mutateAsync({
        subtaskId: subtask.id,
        updates: { assignee_id: newAssigneeId },
        taskId: task.id,
        assignee: assigneeProfile,
      });
      onChanged();
    } catch (error) {
      // Error is handled by React Query
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(subtask.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CheckSquare className="h-4 w-4" />
          Subtasks
          {subtasks.length > 0 && (
            <span className="text-xs">
              ({completedCount}/{subtasks.length})
            </span>
          )}
        </div>
        {!readOnly && (
          <TaskDecomposer
            taskId={task.id}
            onSubtasksCreated={onChanged}
          />
        )}
      </div>

      {subtasks.length > 0 && <Progress value={progress} className="h-1.5" />}

      <div className="space-y-1">
        {subtasks.map((subtask) => {
          const parsedDueDate = subtask.due_date ? new Date(subtask.due_date) : undefined;
          const isOverdue = parsedDueDate && isPast(parsedDueDate) && !isToday(parsedDueDate) && !subtask.completed;
          const isProcessing = processingIds.has(subtask.id);

          return (
            <div
              key={subtask.id}
              className={cn(
                "flex items-center gap-2 group p-2 rounded-md hover:bg-secondary/50 transition-colors",
                subtask.completed && "opacity-60",
                isProcessing && "opacity-50"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
              <Checkbox
                checked={subtask.completed}
                onCheckedChange={() => handleToggle(subtask)}
                className="shrink-0"
                disabled={readOnly || isProcessing}
              />
              
              {/* Title */}
              {editingId === subtask.id ? (
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleSaveEdit(subtask.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(subtask.id);
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditingTitle("");
                    }
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                  disabled={isProcessing}
                />
              ) : (
                <span
                  className={cn(
                    "flex-1 text-sm cursor-pointer min-w-0 truncate",
                    subtask.completed && "line-through",
                    readOnly && "cursor-default"
                  )}
                  onClick={() => {
                    if (!readOnly) {
                      setEditingId(subtask.id);
                      setEditingTitle(subtask.title);
                    }
                  }}
                >
                  {subtask.title}
                </span>
              )}

              {/* Due Date Picker */}
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-6 w-6 shrink-0",
                        subtask.due_date ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        isOverdue && "text-destructive"
                      )}
                      disabled={isProcessing}
                    >
                      <CalendarIcon className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={parsedDueDate}
                      onSelect={(date) => handleDueDateChange(subtask, date)}
                      initialFocus
                    />
                    {subtask.due_date && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDueDateChange(subtask, undefined)}
                        >
                          <X className="mr-2 h-3 w-3" />
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}

              {/* Due Date Display */}
              {subtask.due_date && (
                <span className={cn(
                  "text-xs shrink-0",
                  isOverdue ? "text-destructive" : "text-muted-foreground"
                )}>
                  {format(parsedDueDate!, "MMM d")}
                </span>
              )}

              {/* Assignee Picker */}
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-6 w-6 shrink-0 p-0",
                        subtask.assignee ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                      disabled={isProcessing}
                    >
                      {subtask.assignee ? (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={subtask.assignee.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(subtask.assignee.full_name, subtask.assignee.email)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    <ScrollArea className="h-48">
                      {subtask.assignee && (
                        <button
                          className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 text-sm text-muted-foreground"
                          onClick={() => handleAssigneeChange(subtask, null)}
                        >
                          <X className="h-4 w-4" />
                          Unassign
                        </button>
                      )}
                      {members.filter((m) => m.profiles).map((member) => (
                        <button
                          key={member.user_id}
                          className={cn(
                            "w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 transition-colors",
                            subtask.assignee_id === member.user_id && "bg-secondary"
                          )}
                          onClick={() => handleAssigneeChange(subtask, member)}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={member.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(member.profiles?.full_name || null, member.profiles?.email || null)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">
                            {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                          </span>
                        </button>
                      ))}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              )}

              {/* Delete Button */}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(subtask)}
                  disabled={isProcessing}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a subtask..."
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubtask();
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddSubtask}
            disabled={createSubtaskMutation.isPending || !newSubtask.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
