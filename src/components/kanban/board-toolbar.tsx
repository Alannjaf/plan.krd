"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type SortOption = "position" | "name-asc" | "name-desc" | "due-asc" | "due-desc" | "priority-desc" | "priority-asc" | "created-desc" | "created-asc";
export type FilterPriority = "all" | "urgent" | "high" | "medium" | "low";
export type FilterDueDate = "all" | "overdue" | "today" | "week" | "no-date";

interface BoardToolbarProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filterPriority: FilterPriority;
  onFilterPriorityChange: (priority: FilterPriority) => void;
  filterDueDate: FilterDueDate;
  onFilterDueDateChange: (dueDate: FilterDueDate) => void;
}

export function BoardToolbar({
  sortBy,
  onSortChange,
  filterPriority,
  onFilterPriorityChange,
  filterDueDate,
  onFilterDueDateChange,
}: BoardToolbarProps) {
  const hasActiveFilters = filterPriority !== "all" || filterDueDate !== "all";

  const clearFilters = () => {
    onFilterPriorityChange("all");
    onFilterDueDateChange("all");
  };

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case "position": return "Default";
      case "name-asc": return "Name (A-Z)";
      case "name-desc": return "Name (Z-A)";
      case "due-asc": return "Due Date (Earliest)";
      case "due-desc": return "Due Date (Latest)";
      case "priority-desc": return "Priority (High first)";
      case "priority-asc": return "Priority (Low first)";
      case "created-desc": return "Created (Newest)";
      case "created-asc": return "Created (Oldest)";
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
            Sort: {getSortLabel(sortBy)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Sort tasks by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
            <DropdownMenuRadioItem value="position">Default (Position)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name-asc">Name (A-Z)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name-desc">Name (Z-A)</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="due-asc">Due Date (Earliest)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="due-desc">Due Date (Latest)</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="priority-desc">Priority (High first)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="priority-asc">Priority (Low first)</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="created-desc">Created (Newest)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="created-asc">Created (Oldest)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority Filter */}
      <Select value={filterPriority} onValueChange={(v) => onFilterPriorityChange(v as FilterPriority)}>
        <SelectTrigger className="w-[140px] h-8">
          <Filter className="mr-2 h-3.5 w-3.5" />
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Due Date Filter */}
      <Select value={filterDueDate} onValueChange={(v) => onFilterDueDateChange(v as FilterDueDate)}>
        <SelectTrigger className="w-[140px] h-8">
          <Filter className="mr-2 h-3.5 w-3.5" />
          <SelectValue placeholder="Due Date" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Dates</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="today">Due Today</SelectItem>
          <SelectItem value="week">Due This Week</SelectItem>
          <SelectItem value="no-date">No Due Date</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
          <Badge variant="secondary" className="ml-2 h-5 px-1.5">
            {(filterPriority !== "all" ? 1 : 0) + (filterDueDate !== "all" ? 1 : 0)}
          </Badge>
        </Button>
      )}
    </div>
  );
}
