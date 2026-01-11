"use client";

import { useState } from "react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { type List } from "@/lib/actions/lists";
import { Calendar, Flag, ChevronUp, ChevronDown, Archive } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

interface ListViewProps {
  tasks: TaskWithRelations[];
  lists: List[];
  workspaceId: string;
  boardId: string;
}

type SortField = "title" | "status" | "priority" | "due_date" | "assignee";
type SortDirection = "asc" | "desc";

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, null: 4 };
const priorityColors = {
  low: "bg-blue-500/20 text-blue-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400",
};

export function ListView({ tasks, lists, workspaceId, boardId }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>("due_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const listMap = new Map(lists.map((l) => [l.id, l.name]));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;

    switch (sortField) {
      case "title":
        return direction * a.title.localeCompare(b.title);
      case "status":
        return direction * (listMap.get(a.list_id) || "").localeCompare(listMap.get(b.list_id) || "");
      case "priority":
        const aPriority = priorityOrder[a.priority || "null"];
        const bPriority = priorityOrder[b.priority || "null"];
        return direction * (aPriority - bPriority);
      case "due_date":
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return direction;
        if (!b.due_date) return -direction;
        return direction * (new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      case "assignee":
        const aName = a.assignees?.[0]?.profiles?.full_name || "";
        const bName = b.assignees?.[0]?.profiles?.full_name || "";
        return direction * aName.localeCompare(bName);
      default:
        return 0;
    }
  });

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  return (
    <>
      <ScrollArea className="h-full rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center gap-1">
                  Title
                  <SortIcon field="title" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors w-[140px]"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon field="status" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors w-[100px]"
                onClick={() => handleSort("priority")}
              >
                <div className="flex items-center gap-1">
                  Priority
                  <SortIcon field="priority" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors w-[140px]"
                onClick={() => handleSort("due_date")}
              >
                <div className="flex items-center gap-1">
                  Due Date
                  <SortIcon field="due_date" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors w-[180px]"
                onClick={() => handleSort("assignee")}
              >
                <div className="flex items-center gap-1">
                  Assignee
                  <SortIcon field="assignee" />
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Labels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No tasks found
                </TableCell>
              </TableRow>
            ) : (
              sortedTasks.map((task) => {
                const isOverdue = !task.completed && task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                const isDueToday = !task.completed && task.due_date && isToday(new Date(task.due_date));

                return (
                  <TableRow
                    key={task.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      task.archived && "opacity-60",
                      task.completed && "opacity-70"
                    )}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {task.archived && <Archive className="h-4 w-4 text-muted-foreground" />}
                        <span className={cn("font-medium", task.completed && "line-through opacity-60")}>
                          {task.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {listMap.get(task.list_id) || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.priority && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                            priorityColors[task.priority]
                          )}
                        >
                          <Flag className="h-3 w-3" />
                          {task.priority}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.due_date && !task.completed && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-sm",
                            isOverdue && "text-red-400",
                            isDueToday && "text-yellow-400"
                          )}
                        >
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.due_date), "MMM d, yyyy")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.assignees && task.assignees.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {task.assignees.slice(0, 3).map((assignee) => (
                              <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={assignee.profiles?.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(assignee.profiles?.full_name, assignee.profiles?.email)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          {task.assignees.length === 1 && (
                            <span className="text-sm text-muted-foreground">
                              {task.assignees[0].profiles?.full_name || task.assignees[0].profiles?.email}
                            </span>
                          )}
                          {task.assignees.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{task.assignees.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.labels && task.labels.length > 0 && (
                        <div className="flex gap-1">
                          {task.labels.slice(0, 2).map((label) => (
                            <span
                              key={label.id}
                              className="h-2 w-6 rounded-full"
                              style={{ backgroundColor: label.labels.color }}
                              title={label.labels.name}
                            />
                          ))}
                          {task.labels.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{task.labels.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>

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
