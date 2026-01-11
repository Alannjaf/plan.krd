"use client";

import { useState, useEffect } from "react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { getWorkspaceMembers } from "@/lib/actions/assignees";
import { Calendar, Flag, CheckSquare, AlertTriangle } from "lucide-react";
import { format, isPast, isToday, differenceInDays } from "date-fns";

interface WorkloadViewProps {
  tasks: TaskWithRelations[];
  workspaceId: string;
  boardId: string;
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

const MAX_CAPACITY = 10; // Tasks per user before considered overloaded

const priorityColors = {
  low: "bg-blue-500/20 text-blue-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400",
};

export function WorkloadView({ tasks, workspaceId, boardId }: WorkloadViewProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [workspaceId]);

  const loadMembers = async () => {
    setIsLoading(true);
    const data = await getWorkspaceMembers(workspaceId);
    setMembers(data as unknown as Member[]);
    setIsLoading(false);
  };

  const getTasksForUser = (userId: string) => {
    return tasks.filter((task) =>
      task.assignees?.some((a) => a.user_id === userId)
    );
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  const getWorkloadStatus = (taskCount: number) => {
    const percentage = (taskCount / MAX_CAPACITY) * 100;
    if (percentage >= 100) return { label: "Overloaded", color: "text-red-400", bgColor: "bg-red-500" };
    if (percentage >= 70) return { label: "Heavy", color: "text-orange-400", bgColor: "bg-orange-500" };
    if (percentage >= 40) return { label: "Moderate", color: "text-yellow-400", bgColor: "bg-yellow-500" };
    return { label: "Light", color: "text-green-400", bgColor: "bg-green-500" };
  };

  // Get unassigned tasks
  const unassignedTasks = tasks.filter((task) => !task.assignees || task.assignees.length === 0);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading workload data...</div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-6 p-2">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tasks.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unassigned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-400">
                  {unassignedTasks.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">
                  {tasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{members.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Team Workload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Team Workload</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {members.map((member) => {
                const userTasks = getTasksForUser(member.user_id);
                const workloadStatus = getWorkloadStatus(userTasks.length);
                const overdueTasks = userTasks.filter(
                  (t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
                );

                return (
                  <Card key={member.user_id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.profiles?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getInitials(member.profiles?.full_name || null, member.profiles?.email || null)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {member.role}
                            </div>
                          </div>
                        </div>
                        <Badge className={cn("font-normal", workloadStatus.color)}>
                          {workloadStatus.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Capacity Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{userTasks.length} tasks</span>
                          <span>{Math.min(100, Math.round((userTasks.length / MAX_CAPACITY) * 100))}% capacity</span>
                        </div>
                        <Progress
                          value={Math.min(100, (userTasks.length / MAX_CAPACITY) * 100)}
                          className="h-2"
                        />
                      </div>

                      {/* Stats */}
                      <div className="flex gap-4 text-sm">
                        {overdueTasks.length > 0 && (
                          <div className="flex items-center gap-1 text-red-400">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{overdueTasks.length} overdue</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CheckSquare className="h-4 w-4" />
                          <span>
                            {userTasks.filter((t) =>
                              t.subtasks?.every((s) => s.completed)
                            ).length} complete
                          </span>
                        </div>
                      </div>

                      {/* Task Preview */}
                      {userTasks.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            Assigned Tasks
                          </div>
                          <div className="space-y-1 max-h-[150px] overflow-y-auto">
                            {userTasks.slice(0, 5).map((task) => {
                              const isOverdue =
                                task.due_date &&
                                isPast(new Date(task.due_date)) &&
                                !isToday(new Date(task.due_date));

                              return (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-2 rounded bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {task.priority && (
                                      <span
                                        className={cn(
                                          "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                          priorityColors[task.priority]
                                        )}
                                      >
                                        <Flag className="h-3 w-3" />
                                      </span>
                                    )}
                                    <span className="text-sm truncate">{task.title}</span>
                                  </div>
                                  {task.due_date && (
                                    <span
                                      className={cn(
                                        "text-xs shrink-0",
                                        isOverdue ? "text-red-400" : "text-muted-foreground"
                                      )}
                                    >
                                      {format(new Date(task.due_date), "MMM d")}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {userTasks.length > 5 && (
                              <div className="text-xs text-center text-muted-foreground py-1">
                                +{userTasks.length - 5} more tasks
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Unassigned Tasks */}
          {unassignedTasks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                Unassigned Tasks ({unassignedTasks.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {unassignedTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {task.priority && (
                            <span
                              className={cn(
                                "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                priorityColors[task.priority]
                              )}
                            >
                              <Flag className="h-3 w-3" />
                            </span>
                          )}
                          <span className="text-sm truncate">{task.title}</span>
                        </div>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(task.due_date), "MMM d")}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
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
