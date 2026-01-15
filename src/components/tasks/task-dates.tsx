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
import { CalendarIcon, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { suggestAndStoreDueDate } from "@/lib/actions/ai-insights";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface TaskDatesProps {
  task: TaskWithRelations;
  onChanged: () => void;
  readOnly?: boolean;
}

export function TaskDates({ task, onChanged, readOnly = false }: TaskDatesProps) {
  const updateTaskMutation = useUpdateTask();
  const [isSuggesting, setIsSuggesting] = useState(false);

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

  const handleSuggestDueDate = async () => {
    setIsSuggesting(true);
    try {
      const result = await suggestAndStoreDueDate(task.id, true);
      if (result.success && result.suggestion) {
        const suggestedDate = new Date(result.suggestion.suggested_date);
        handleDateChange("due_date", suggestedDate);
        toast.success(`Suggested due date: ${format(suggestedDate, "PPP")}`);
      } else {
        toast.error(result.error || "Failed to suggest due date");
      }
    } catch (error) {
      toast.error("Failed to suggest due date");
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground flex items-center justify-between">
        <span>Dates</span>
        {!readOnly && !task.id.startsWith("temp-") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSuggestDueDate}
            disabled={isSuggesting}
            className="h-7"
          >
            {isSuggesting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            <span className="ml-1 text-xs">AI Suggest</span>
          </Button>
        )}
      </div>

      {/* Start Date */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Start date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={readOnly}
              className={cn(
                "w-full justify-start text-left font-normal",
                !task.start_date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {parsedStartDate ? format(parsedStartDate, "PPP") : "Set start date"}
            </Button>
          </PopoverTrigger>
          {!readOnly && (
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
          )}
        </Popover>
      </div>

      {/* Due Date */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Due date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={readOnly}
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
          {!readOnly && (
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
          )}
        </Popover>
      </div>
    </div>
  );
}
