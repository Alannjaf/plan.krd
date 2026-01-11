"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";
import { updateTask, completeTask, uncompleteTask, type TaskWithRelations } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";

interface TaskHeaderProps {
  task: TaskWithRelations;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
}

export function TaskHeader({ task, setTask, onChanged }: TaskHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleSaveTitle = async () => {
    if (!title.trim() || title === task.title) {
      setIsEditing(false);
      return;
    }

    const oldTitle = task.title;
    const newTitle = title.trim();

    // Optimistic update
    setTask((prev) => (prev ? { ...prev, title: newTitle } : prev));
    onChanged();
    setIsEditing(false);

    // Persist to database
    const result = await updateTask(task.id, { title: newTitle });

    // Rollback on error
    if (!result.success) {
      setTask((prev) => (prev ? { ...prev, title: oldTitle } : prev));
      setTitle(oldTitle);
    }
  };

  const handleCompletionToggle = async () => {
    setIsCompleting(true);
    const wasCompleted = task.completed;
    const now = new Date().toISOString();

    // Optimistic update
    setTask((prev) =>
      prev
        ? {
            ...prev,
            completed: !wasCompleted,
            completed_at: !wasCompleted ? now : null,
          }
        : prev
    );
    onChanged();

    // Persist to database
    const result = wasCompleted
      ? await uncompleteTask(task.id)
      : await completeTask(task.id);

    // Rollback on error
    if (!result.success) {
      setTask((prev) =>
        prev
          ? {
              ...prev,
              completed: wasCompleted,
              completed_at: wasCompleted ? now : null,
            }
          : prev
      );
    }
    setIsCompleting(false);
  };

  return (
    <div className="flex-1 min-w-0 pr-8">
      <div className="flex items-center gap-3 mb-2">
        <Checkbox
          checked={task.completed}
          onCheckedChange={handleCompletionToggle}
          disabled={isCompleting}
          className="h-5 w-5 shrink-0"
        />
        {task.completed && (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        )}
      </div>
      {isEditing ? (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(
            "text-xl font-semibold",
            task.completed && "line-through opacity-60"
          )}
          autoFocus
          onBlur={handleSaveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setTitle(task.title);
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <h2
          className={cn(
            "text-xl font-semibold cursor-pointer hover:text-primary transition-colors",
            task.completed && "line-through opacity-60"
          )}
          onClick={() => setIsEditing(true)}
        >
          {task.title}
        </h2>
      )}
    </div>
  );
}
