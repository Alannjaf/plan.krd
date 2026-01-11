"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  createSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtask,
  type Subtask,
} from "@/lib/actions/subtasks";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { CheckSquare, Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubtaskListProps {
  task: TaskWithRelations;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
}

export function SubtaskList({ task, setTask, onChanged }: SubtaskListProps) {
  const [newSubtask, setNewSubtask] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const subtasks = task.subtasks || [];
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
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className={cn(
              "flex items-center gap-2 group p-2 rounded-md hover:bg-secondary/50 transition-colors",
              subtask.completed && "opacity-60"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={() => handleToggle(subtask)}
              className="shrink-0"
            />
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
                className="h-7 text-sm"
                autoFocus
              />
            ) : (
              <span
                className={cn(
                  "flex-1 text-sm cursor-pointer",
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
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(subtask)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
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
