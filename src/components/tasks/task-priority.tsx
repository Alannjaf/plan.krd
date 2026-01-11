"use client";

import { type Dispatch, type SetStateAction } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTask, type TaskWithRelations } from "@/lib/actions/tasks";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent" | null;

interface TaskPriorityProps {
  task: TaskWithRelations;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
}

const priorities = [
  { value: "urgent", label: "Urgent", color: "text-red-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low", label: "Low", color: "text-blue-500" },
] as const;

export function TaskPriority({ task, setTask, onChanged }: TaskPriorityProps) {
  const handleChange = async (value: string) => {
    const newPriority: Priority = value === "none" ? null : (value as Priority);
    const oldPriority = task.priority;

    // Optimistic update
    setTask((prev) => (prev ? { ...prev, priority: newPriority } : prev));
    onChanged();

    // Persist to database
    const result = await updateTask(task.id, { priority: newPriority });

    // Rollback on error
    if (!result.success) {
      setTask((prev) => (prev ? { ...prev, priority: oldPriority } : prev));
    }
  };

  const currentPriority = priorities.find((p) => p.value === task.priority);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Flag className="h-4 w-4" />
        Priority
      </div>

      <Select value={task.priority || "none"} onValueChange={handleChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Set priority">
            {currentPriority ? (
              <span className={cn("flex items-center gap-2", currentPriority.color)}>
                <Flag className="h-4 w-4" />
                {currentPriority.label}
              </span>
            ) : (
              <span className="text-muted-foreground">No priority</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No priority</span>
          </SelectItem>
          {priorities.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <span className={cn("flex items-center gap-2", p.color)}>
                <Flag className="h-4 w-4" />
                {p.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
