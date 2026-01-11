"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { updateTask, type TaskWithRelations } from "@/lib/actions/tasks";

interface TaskHeaderProps {
  task: TaskWithRelations;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
}

export function TaskHeader({ task, setTask, onChanged }: TaskHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

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

  return (
    <div className="flex-1 min-w-0 pr-8">
      {isEditing ? (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-semibold"
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
          className="text-xl font-semibold cursor-pointer hover:text-primary transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {task.title}
        </h2>
      )}
    </div>
  );
}
