"use client";

import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { useUpdateTask } from "@/lib/query/mutations/tasks";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskDatesProps {
  task: TaskWithRelations;
  onChanged: () => void;
}

export function TaskDates({ task, onChanged }: TaskDatesProps) {
  const updateTaskMutation = useUpdateTask();

  const handleDateChange = (
    field: "start_date" | "due_date",
    date: Date | undefined
  ) => {
    const newValue = date ? format(date, "yyyy-MM-dd") : null;
    onChanged();

    updateTaskMutation.mutate({
      taskId: task.id,
      updates: { [field]: newValue },
    });
  };

  const parsedStartDate = task.start_date ? new Date(task.start_date) : undefined;
  const parsedDueDate = task.due_date ? new Date(task.due_date) : undefined;

  const isOverdue =
    parsedDueDate && parsedDueDate < new Date() && !task.start_date;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">Dates</div>

      {/* Start Date */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Start date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !task.start_date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {parsedStartDate ? format(parsedStartDate, "PPP") : "Set start date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedStartDate}
              onSelect={(date) => handleDateChange("start_date", date)}
              initialFocus
            />
            {task.start_date && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDateChange("start_date", undefined)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Due Date */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Due date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !task.due_date && "text-muted-foreground",
                isOverdue && "border-destructive text-destructive"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {parsedDueDate ? format(parsedDueDate, "PPP") : "Set due date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedDueDate}
              onSelect={(date) => handleDateChange("due_date", date)}
              initialFocus
            />
            {task.due_date && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDateChange("due_date", undefined)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
