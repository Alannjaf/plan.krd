"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutGrid, List, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewType = "kanban" | "list" | "calendar" | "workload";

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const views: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: "kanban", label: "Kanban", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "list", label: "List", icon: <List className="h-4 w-4" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
  { id: "workload", label: "Workload", icon: <Users className="h-4 w-4" /> },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center bg-secondary/50 rounded-lg p-0.5">
        {views.map((view) => (
          <Tooltip key={view.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 gap-2",
                  currentView === view.id &&
                    "bg-background shadow-sm hover:bg-background"
                )}
                onClick={() => onViewChange(view.id)}
              >
                {view.icon}
                <span className="hidden sm:inline text-xs">{view.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{view.label} View</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
