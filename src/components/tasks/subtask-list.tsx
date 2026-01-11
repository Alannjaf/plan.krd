"use client";

import { useState } from "react";
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
import { logActivity } from "@/lib/actions/activities";
import { CheckSquare, Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  onUpdate: () => void;
}

export function SubtaskList({ taskId, subtasks, onUpdate }: SubtaskListProps) {
  const [newSubtask, setNewSubtask] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const completedCount = subtasks.filter((s) => s.completed).length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    setIsAdding(true);
    const result = await createSubtask(taskId, newSubtask.trim());
    if (result.success) {
      await logActivity(taskId, "subtask_added", { title: newSubtask.trim() });
      onUpdate();
    }
    setNewSubtask("");
    setIsAdding(false);
  };

  const handleToggle = async (subtask: Subtask) => {
    await toggleSubtask(subtask.id, !subtask.completed);
    if (!subtask.completed) {
      await logActivity(taskId, "subtask_completed", { title: subtask.title });
    }
    onUpdate();
  };

  const handleDelete = async (subtask: Subtask) => {
    await deleteSubtask(subtask.id);
    await logActivity(taskId, "subtask_deleted", { title: subtask.title });
    onUpdate();
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editingTitle.trim()) return;
    await updateSubtask(subtaskId, { title: editingTitle.trim() });
    setEditingId(null);
    setEditingTitle("");
    onUpdate();
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

      {subtasks.length > 0 && (
        <Progress value={progress} className="h-1.5" />
      )}

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
