"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { updateTask } from "@/lib/actions/tasks";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskDatesProps {
  taskId: string;
  startDate: string | null;
  dueDate: string | null;
  onUpdate: () => void;
}

export function TaskDates({
  taskId,
  startDate,
  dueDate,
  onUpdate,
}: TaskDatesProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDateChange = async (
    field: "start_date" | "due_date",
    date: Date | undefined
  ) => {
    setIsUpdating(true);
    await updateTask(taskId, {
      [field]: date ? format(date, "yyyy-MM-dd") : null,
    });
    onUpdate();
    setIsUpdating(false);
  };

  const parsedStartDate = startDate ? new Date(startDate) : undefined;
  const parsedDueDate = dueDate ? new Date(dueDate) : undefined;

  const isOverdue =
    parsedDueDate && parsedDueDate < new Date() && !startDate;

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
                !startDate && "text-muted-foreground"
              )}
              disabled={isUpdating}
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
            {startDate && (
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
                !dueDate && "text-muted-foreground",
                isOverdue && "border-destructive text-destructive"
              )}
              disabled={isUpdating}
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
            {dueDate && (
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
