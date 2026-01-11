"use client";

import { useState } from "react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";

interface CalendarViewProps {
  tasks: TaskWithRelations[];
  workspaceId: string;
  boardId: string;
}

type CalendarMode = "month" | "week";

const priorityColors = {
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export function CalendarView({ tasks, workspaceId, boardId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>("month");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const getDaysInView = () => {
    if (mode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), day);
    });
  };

  const handlePrevious = () => {
    if (mode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (mode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const days = getDaysInView();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">
              {format(currentDate, mode === "month" ? "MMMM yyyy" : "'Week of' MMM d, yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3",
                mode === "month" && "bg-background shadow-sm"
              )}
              onClick={() => setMode("month")}
            >
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3",
                mode === "week" && "bg-background shadow-sm"
              )}
              onClick={() => setMode("week")}
            >
              Week
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Week Day Headers */}
          <div className="grid grid-cols-7 border-b">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <ScrollArea className="flex-1">
            <div
              className={cn(
                "grid grid-cols-7",
                mode === "month" ? "auto-rows-fr" : "h-full"
              )}
            >
              {days.map((day, index) => {
                const dayTasks = getTasksForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={index}
                    className={cn(
                      "border-r border-b p-2 min-h-[100px]",
                      mode === "week" && "min-h-[400px]",
                      !isCurrentMonth && "bg-muted/30",
                      index % 7 === 6 && "border-r-0"
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full",
                        isCurrentDay && "bg-primary text-primary-foreground",
                        !isCurrentMonth && "text-muted-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, mode === "week" ? 10 : 3).map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "text-xs p-1.5 rounded cursor-pointer transition-colors",
                            "bg-secondary hover:bg-secondary/80",
                            task.archived && "opacity-60"
                          )}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div className="flex items-center gap-1">
                            {task.priority && (
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  priorityColors[task.priority]
                                )}
                              />
                            )}
                            <span className="truncate">{task.title}</span>
                          </div>
                        </div>
                      ))}
                      {dayTasks.length > (mode === "week" ? 10 : 3) && (
                        <div className="text-xs text-muted-foreground pl-1">
                          +{dayTasks.length - (mode === "week" ? 10 : 3)} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        boardId={boardId}
        workspaceId={workspaceId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onTaskUpdated={() => {}}
      />
    </>
  );
}
