"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addAssignee, removeAssignee } from "@/lib/actions/assignees";
import { useWorkspaceMembers } from "@/lib/query/queries/members";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queries/tasks";
import { Users, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AutoAssignmentPanel } from "@/components/ai/auto-assignment-panel";

type WorkspaceMember = {
  user_id: string;
  role: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface TaskAssigneesProps {
  task: TaskWithRelations;
  workspaceId: string;
  boardId: string;
  onChanged: () => void;
  readOnly?: boolean;
}

export function TaskAssignees({
  task,
  workspaceId,
  boardId,
  onChanged,
  readOnly = false,
}: TaskAssigneesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  
  const { data: membersData = [] } = useWorkspaceMembers(workspaceId);
  const members = membersData as unknown as WorkspaceMember[];

  const assignees = task.assignees || [];
  const assignedUserIds = assignees.map((a) => a.user_id);

  const filteredMembers = members.filter((m) => {
    if (!m.profiles) return false;
    const name = m.profiles.full_name?.toLowerCase() || "";
    const email = m.profiles.email?.toLowerCase() || "";
    const query = search.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const handleToggleAssignee = async (member: WorkspaceMember) => {
    if (readOnly || !member.profiles) return;
    const isAssigned = assignedUserIds.includes(member.user_id);
    onChanged();

    // Create optimistic assignee data
    const newAssignee = {
      id: `temp-${Date.now()}`,
      task_id: task.id,
      user_id: member.user_id,
      created_at: new Date().toISOString(),
      profiles: member.profiles,
    };

    const optimisticAssignees = isAssigned
      ? assignees.filter((a) => a.user_id !== member.user_id)
      : [...assignees, newAssignee];

    // Optimistically update caches BEFORE server call
    queryClient.setQueryData<TaskWithRelations>(queryKeys.task(task.id), (old) =>
      old ? { ...old, assignees: optimisticAssignees } : old
    );
    queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard(boardId), (old) =>
      old?.map((t) => (t.id === task.id ? { ...t, assignees: optimisticAssignees } : t))
    );

    // Execute server action
    const result = isAssigned
      ? await removeAssignee(task.id, member.user_id)
      : await addAssignee(task.id, member.user_id);

    if (!result.success) {
      // Rollback on error by invalidating
      queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
      queryClient.invalidateQueries({ queryKey: ["tasks", "board"] });
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  return (
      <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Assignees
        </div>
        {!readOnly && !task.id.startsWith("temp-") && (
          <AutoAssignmentPanel
            taskId={task.id}
            onAssigned={() => {
              onChanged();
              queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
              queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard(boardId) });
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {assignees.map((assignee) => (
          <div
            key={assignee.id}
            className="flex items-center gap-2 bg-secondary/50 rounded-full pl-1 pr-2 py-1"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={assignee.profiles?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(assignee.profiles?.full_name || null, assignee.profiles?.email || null)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">
              {assignee.profiles?.full_name || assignee.profiles?.email}
            </span>
            {!readOnly && (
              <button
                className="hover:text-destructive transition-colors"
                onClick={() =>
                  handleToggleAssignee({
                    user_id: assignee.user_id,
                    role: "",
                    profiles: assignee.profiles!,
                  })
                }
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {!readOnly && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-48">
                {filteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No members found
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredMembers.map((member) => {
                      const isAssigned = assignedUserIds.includes(member.user_id);
                      return (
                        <button
                          key={member.user_id}
                          className={cn(
                            "w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 transition-colors",
                            isAssigned && "bg-secondary"
                          )}
                          onClick={() => handleToggleAssignee(member)}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.profiles?.full_name || null, member.profiles?.email || null)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-left text-sm truncate">
                            {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                          </span>
                          {isAssigned && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
