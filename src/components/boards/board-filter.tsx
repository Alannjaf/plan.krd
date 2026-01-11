"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Filter, X, Calendar as CalendarIcon } from "lucide-react";
import { useLabels } from "@/lib/query/queries/labels";
import { useWorkspaceMembers } from "@/lib/query/queries/members";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { type TaskWithRelations } from "@/lib/actions/tasks";

export type FilterState = {
  assigneeId: string | null;
  labelId: string | null;
  priority: string | null;
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
};

interface BoardFilterProps {
  boardId: string;
  workspaceId: string;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

type Member = {
  user_id: string;
  role: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function BoardFilter({
  boardId,
  workspaceId,
  filters,
  onFiltersChange,
}: BoardFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: labels = [] } = useLabels(boardId);
  const { data: membersData = [] } = useWorkspaceMembers(workspaceId);
  const members = membersData as unknown as Member[];

  const hasActiveFilters = 
    filters.assigneeId || 
    filters.labelId || 
    filters.priority || 
    filters.dueDateFrom || 
    filters.dueDateTo;

  const clearFilters = () => {
    onFiltersChange({
      assigneeId: null,
      labelId: null,
      priority: null,
      dueDateFrom: null,
      dueDateTo: null,
    });
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  const activeFilterCount = [
    filters.assigneeId,
    filters.labelId,
    filters.priority,
    filters.dueDateFrom || filters.dueDateTo,
  ].filter(Boolean).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilters ? "secondary" : "ghost"}
          size="sm"
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          {/* Assignee Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Assignee</label>
            <Select
              value={filters.assigneeId || "all"}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, assigneeId: value === "all" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any assignee</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(member.profiles?.full_name || null, member.profiles?.email || null)}
                        </AvatarFallback>
                      </Avatar>
                      {member.profiles?.full_name || member.profiles?.email}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Label</label>
            <Select
              value={filters.labelId || "all"}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, labelId: value === "all" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any label</SelectItem>
                {labels.map((label) => (
                  <SelectItem key={label.id} value={label.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Select
              value={filters.priority || "all"}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, priority: value === "all" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date Range</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dueDateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dueDateFrom
                      ? format(filters.dueDateFrom, "MMM d")
                      : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dueDateFrom || undefined}
                    onSelect={(date) =>
                      onFiltersChange({ ...filters, dueDateFrom: date || null })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dueDateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dueDateTo
                      ? format(filters.dueDateTo, "MMM d")
                      : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dueDateTo || undefined}
                    onSelect={(date) =>
                      onFiltersChange({ ...filters, dueDateTo: date || null })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function to filter tasks
export function filterTasks(
  tasks: TaskWithRelations[],
  filters: FilterState
): TaskWithRelations[] {
  return tasks.filter((task) => {
    // Assignee filter
    if (filters.assigneeId) {
      if (filters.assigneeId === "unassigned") {
        if (task.assignees && task.assignees.length > 0) return false;
      } else {
        if (!task.assignees?.some((a) => a.user_id === filters.assigneeId)) return false;
      }
    }

    // Label filter
    if (filters.labelId) {
      if (!task.labels?.some((l) => l.label_id === filters.labelId)) return false;
    }

    // Priority filter
    if (filters.priority) {
      if (task.priority !== filters.priority) return false;
    }

    // Due date range filter
    if (filters.dueDateFrom || filters.dueDateTo) {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      if (filters.dueDateFrom && dueDate < filters.dueDateFrom) return false;
      if (filters.dueDateTo && dueDate > filters.dueDateTo) return false;
    }

    return true;
  });
}
