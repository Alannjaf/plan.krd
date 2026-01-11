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
import {
  createSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtask,
} from "@/lib/actions/subtasks";
import { useWorkspaceMembers } from "@/lib/query/queries/members";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys as taskQueryKeys } from "@/lib/query/queries/tasks";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { format, isPast, isToday } from "date-fns";
import { CheckSquare, Plus, Trash2, GripVertical, CalendarIcon, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();
  const [newSubtask, setNewSubtask] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  const { data: membersData = [] } = useWorkspaceMembers(workspaceId);
  const members = membersData as unknown as WorkspaceMember[];

  const subtasks = task.subtasks || [];

  const invalidateTask = () => {
    queryClient.invalidateQueries({ queryKey: taskQueryKeys.task(task.id) });
  };

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
    setIsAdding(true);

    const result = await createSubtask(task.id, newSubtask.trim());
    if (result.success) {
      invalidateTask();
      onChanged();
    }
    setNewSubtask("");
    setIsAdding(false);
  };

  const handleToggle = async (subtask: SubtaskItem) => {
    if (readOnly) return;
    const newCompleted = !subtask.completed;
    
    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    const result = await toggleSubtask(subtask.id, newCompleted);
    if (result.success) {
      invalidateTask();
      onChanged();
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(subtask.id);
      return next;
    });
  };

  const handleDelete = async (subtask: SubtaskItem) => {
    if (readOnly) return;
    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    
    const result = await deleteSubtask(subtask.id);
    if (result.success) {
      invalidateTask();
      onChanged();
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(subtask.id);
      return next;
    });
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editingTitle.trim() || readOnly) return;

    setProcessingIds((prev) => new Set(prev).add(subtaskId));
    const result = await updateSubtask(subtaskId, { title: editingTitle.trim() });
    if (result.success) {
      invalidateTask();
      onChanged();
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(subtaskId);
      return next;
    });
    setEditingId(null);
    setEditingTitle("");
  };

  const handleDueDateChange = async (subtask: SubtaskItem, date: Date | undefined) => {
    if (readOnly) return;
    const newDate = date ? format(date, "yyyy-MM-dd") : null;

    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    const result = await updateSubtask(subtask.id, { due_date: newDate });
    if (result.success) {
      invalidateTask();
      onChanged();
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(subtask.id);
      return next;
    });
  };

  const handleAssigneeChange = async (subtask: SubtaskItem, member: WorkspaceMember | null) => {
    if (readOnly) return;
    const newAssigneeId = member?.user_id || null;

    setProcessingIds((prev) => new Set(prev).add(subtask.id));
    const result = await updateSubtask(subtask.id, { assignee_id: newAssigneeId });
    if (result.success) {
      invalidateTask();
      onChanged();
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(subtask.id);
      return next;
    });
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
            disabled={isAdding || !newSubtask.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
