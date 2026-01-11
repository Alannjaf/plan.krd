"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTask } from "@/lib/actions/tasks";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskPriorityProps {
  taskId: string;
  priority: "low" | "medium" | "high" | "urgent" | null;
  onUpdate: () => void;
}

const priorities = [
  { value: "urgent", label: "Urgent", color: "text-red-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low", label: "Low", color: "text-blue-500" },
] as const;

export function TaskPriority({ taskId, priority, onUpdate }: TaskPriorityProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (value: string) => {
    setIsUpdating(true);
    const newPriority = value === "none" ? null : (value as typeof priority);
    await updateTask(taskId, { priority: newPriority });
    onUpdate();
    setIsUpdating(false);
  };

  const currentPriority = priorities.find((p) => p.value === priority);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Flag className="h-4 w-4" />
        Priority
      </div>

      <Select
        value={priority || "none"}
        onValueChange={handleChange}
        disabled={isUpdating}
      >
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
