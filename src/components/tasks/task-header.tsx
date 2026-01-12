"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { useUpdateTask, useCompleteTask, useUncompleteTask } from "@/lib/query/mutations/tasks";
import { cn } from "@/lib/utils";

interface TaskHeaderProps {
  task: TaskWithRelations;
  onChanged: () => void;
  readOnly?: boolean;
}

export function TaskHeader({ task, onChanged, readOnly = false }: TaskHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const updateTaskMutation = useUpdateTask();
  const completeTaskMutation = useCompleteTask();
  const uncompleteTaskMutation = useUncompleteTask();

  const handleSaveTitle = () => {
    if (!title.trim() || title === task.title) {
      setIsEditing(false);
      return;
    }

    const newTitle = title.trim();
    setIsEditing(false);
    onChanged();

    updateTaskMutation.mutate(
      { taskId: task.id, updates: { title: newTitle } },
      {
        onError: () => {
          // Rollback on error
          setTitle(task.title);
        },
      }
    );
  };

  const handleCompletionToggle = () => {
    onChanged();

    if (task.completed) {
      uncompleteTaskMutation.mutate(task.id);
    } else {
      completeTaskMutation.mutate(task.id);
    }
  };

  return (
    <div className="flex-1 min-w-0 pr-8">
      <div className="flex items-center gap-3 mb-2">
        <Checkbox
          checked={task.completed}
          onCheckedChange={handleCompletionToggle}
          disabled={readOnly || completeTaskMutation.isPending || uncompleteTaskMutation.isPending}
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
            "text-xl font-semibold transition-colors",
            !readOnly && "cursor-pointer hover:text-primary",
            task.completed && "line-through opacity-60"
          )}
          onClick={() => !readOnly && setIsEditing(true)}
        >
          {task.title}
        </h2>
      )}
    </div>
  );
}
