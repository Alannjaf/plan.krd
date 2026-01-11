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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowUpDown, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type SortOption = "position" | "name-asc" | "name-desc" | "due-asc" | "due-desc" | "priority-desc" | "priority-asc" | "created-desc" | "created-asc";
export type FilterPriority = "all" | "urgent" | "high" | "medium" | "low";
export type FilterDueDate = "all" | "overdue" | "today" | "week" | "no-date";

interface ColumnToolbarProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filterPriority: FilterPriority;
  onFilterPriorityChange: (priority: FilterPriority) => void;
  filterDueDate: FilterDueDate;
  onFilterDueDateChange: (dueDate: FilterDueDate) => void;
}

export function ColumnToolbar({
  sortBy,
  onSortChange,
  filterPriority,
  onFilterPriorityChange,
  filterDueDate,
  onFilterDueDateChange,
}: ColumnToolbarProps) {
  const hasActiveFilters = filterPriority !== "all" || filterDueDate !== "all";
  const isCustomSort = sortBy !== "position";

  const clearAll = () => {
    onSortChange("position");
    onFilterPriorityChange("all");
    onFilterDueDateChange("all");
  };

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case "position": return "Default";
      case "name-asc": return "A-Z";
      case "name-desc": return "Z-A";
      case "due-asc": return "Due ↑";
      case "due-desc": return "Due ↓";
      case "priority-desc": return "Priority ↓";
      case "priority-asc": return "Priority ↑";
      case "created-desc": return "New";
      case "created-asc": return "Old";
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-6 w-6 ${isCustomSort ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
            <DropdownMenuRadioItem value="position">Default</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name-asc">Name (A-Z)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name-desc">Name (Z-A)</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="due-asc">Due (Earliest)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="due-desc">Due (Latest)</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="priority-desc">Priority (High)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="priority-asc">Priority (Low)</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="created-desc">Newest</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="created-asc">Oldest</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-6 w-6 relative ${hasActiveFilters ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Filter className="h-3.5 w-3.5" />
            {hasActiveFilters && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-2">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Priority</p>
              <div className="flex flex-wrap gap-1">
                {(["all", "urgent", "high", "medium", "low"] as const).map((p) => (
                  <Button
                    key={p}
                    variant={filterPriority === p ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => onFilterPriorityChange(p)}
                  >
                    {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Due Date</p>
              <div className="flex flex-wrap gap-1">
                {(["all", "overdue", "today", "week", "no-date"] as const).map((d) => (
                  <Button
                    key={d}
                    variant={filterDueDate === d ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => onFilterDueDateChange(d)}
                  >
                    {d === "all" ? "All" : d === "no-date" ? "None" : d === "week" ? "Week" : d.charAt(0).toUpperCase() + d.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear All */}
      {(hasActiveFilters || isCustomSort) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={clearAll}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
