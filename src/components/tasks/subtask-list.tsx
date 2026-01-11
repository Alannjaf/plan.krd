"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
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
  type Subtask,
} from "@/lib/actions/subtasks";
import { getWorkspaceMembers } from "@/lib/actions/assignees";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { format, isPast, isToday } from "date-fns";
import { CheckSquare, Plus, Trash2, GripVertical, CalendarIcon, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubtaskListProps {
  task: TaskWithRelations;
  workspaceId: string;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
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

export function SubtaskList({ task, workspaceId, setTask, onChanged }: SubtaskListProps) {
  const [newSubtask, setNewSubtask] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const subtasks = task.subtasks || [];

  useEffect(() => {
    if (workspaceId) {
      loadMembers();
    }
  }, [workspaceId]);

  const loadMembers = async () => {
    if (!workspaceId) return;
    const data = await getWorkspaceMembers(workspaceId);
    setMembers(data as WorkspaceMember[]);
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
    if (!newSubtask.trim()) return;
    setIsAdding(true);

    const tempId = `temp-${Date.now()}`;
    const newItem: Subtask = {
      id: tempId,
      parent_task_id: task.id,
      title: newSubtask.trim(),
      completed: false,
      position: subtasks.length,
      created_at: new Date().toISOString(),
    };

    // Optimistic add
    setTask((prev) =>
      prev
        ? {
            ...prev,
            subtasks: [...(prev.subtasks || []), newItem],
          }
        : prev
    );
    onChanged();
    setNewSubtask("");

    const result = await createSubtask(task.id, newItem.title);
    if (!result.success) {
      // Rollback
      setTask((prev) =>
        prev
          ? {
              ...prev,
              subtasks: prev.subtasks?.filter((s) => s.id !== tempId),
            }
          : prev
      );
    }
    setIsAdding(false);
  };

  const handleToggle = async (subtask: Subtask) => {
    const newCompleted = !subtask.completed;

    // Optimistic toggle
    setTask((prev) =>
      prev
        ? {
            ...prev,
            subtasks: prev.subtasks?.map((s) =>
              s.id === subtask.id ? { ...s, completed: newCompleted } : s
            ),
          }
        : prev
    );
    onChanged();

    const result = await toggleSubtask(subtask.id, newCompleted);
    if (!result.success) {
      // Rollback
      setTask((prev) =>
        prev
          ? {
              ...prev,
              subtasks: prev.subtasks?.map((s) =>
                s.id === subtask.id ? { ...s, completed: subtask.completed } : s
              ),
            }
          : prev
      );
    }
  };

  const handleDelete = async (subtask: Subtask) => {
    const oldSubtasks = [...subtasks];

    // Optimistic delete
    setTask((prev) =>
      prev
        ? {
            ...prev,
            subtasks: prev.subtasks?.filter((s) => s.id !== subtask.id),
          }
        : prev
    );
    onChanged();

    const result = await deleteSubtask(subtask.id);
    if (!result.success) {
      // Rollback
      setTask((prev) => (prev ? { ...prev, subtasks: oldSubtasks } : prev));
    }
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editingTitle.trim()) return;

    const oldSubtasks = [...subtasks];

    // Optimistic update
    setTask((prev) =>
      prev
        ? {
            ...prev,
            subtasks: prev.subtasks?.map((s) =>
              s.id === subtaskId ? { ...s, title: editingTitle.trim() } : s
            ),
          }
        : prev
    );
    onChanged();

    const result = await updateSubtask(subtaskId, { title: editingTitle.trim() });
    if (!result.success) {
      // Rollback
      setTask((prev) => (prev ? { ...prev, subtasks: oldSubtasks } : prev));
    }

    setEditingId(null);
    setEditingTitle("");
  };

  const handleDueDateChange = async (subtask: Subtask, date: Date | undefined) => {
    const oldSubtasks = [...subtasks];
    const newDate = date ? format(date, "yyyy-MM-dd") : null;

    // Optimistic update
    setTask((prev) =>
      prev
        ? {
            ...prev,
            subtasks: prev.subtasks?.map((s) =>
              s.id === subtask.id ? { ...s, due_date: newDate } : s
            ),
          }
        : prev
    );
    onChanged();

    const result = await updateSubtask(subtask.id, { due_date: newDate });
    if (!result.success) {
      setTask((prev) => (prev ? { ...prev, subtasks: oldSubtasks } : prev));
    }
  };

  const handleAssigneeChange = async (subtask: Subtask, member: WorkspaceMember | null) => {
    const oldSubtasks = [...subtasks];
    const newAssigneeId = member?.user_id || null;
    const newAssignee = member?.profiles
      ? {
          id: member.profiles.id,
          email: member.profiles.email,
          full_name: member.profiles.full_name,
          avatar_url: member.profiles.avatar_url,
        }
      : null;

    // Optimistic update
    setTask((prev) =>
      prev
        ? {
            ...prev,
            subtasks: prev.subtasks?.map((s) =>
              s.id === subtask.id
                ? { ...s, assignee_id: newAssigneeId, assignee: newAssignee }
                : s
            ),
          }
        : prev
    );
    onChanged();

    const result = await updateSubtask(subtask.id, { assignee_id: newAssigneeId });
    if (!result.success) {
      setTask((prev) => (prev ? { ...prev, subtasks: oldSubtasks } : prev));
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
      </div>

      {subtasks.length > 0 && <Progress value={progress} className="h-1.5" />}

      <div className="space-y-1">
        {subtasks.map((subtask) => {
          const parsedDueDate = subtask.due_date ? new Date(subtask.due_date) : undefined;
          const isOverdue = parsedDueDate && isPast(parsedDueDate) && !isToday(parsedDueDate) && !subtask.completed;

          return (
            <div
              key={subtask.id}
              className={cn(
                "flex items-center gap-2 group p-2 rounded-md hover:bg-secondary/50 transition-colors",
                subtask.completed && "opacity-60"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
              <Checkbox
                checked={subtask.completed}
                onCheckedChange={() => handleToggle(subtask)}
                className="shrink-0"
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
                />
              ) : (
                <span
                  className={cn(
                    "flex-1 text-sm cursor-pointer min-w-0 truncate",
                    subtask.completed && "line-through"
                  )}
                  onClick={() => {
                    setEditingId(subtask.id);
                    setEditingTitle(subtask.title);
                  }}
                >
                  {subtask.title}
                </span>
              )}

              {/* Due Date Picker */}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6 shrink-0 p-0",
                      subtask.assignee ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
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

              {/* Delete Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(subtask)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
