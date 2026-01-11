"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addAssignee, removeAssignee, getWorkspaceMembers } from "@/lib/actions/assignees";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { Users, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceMember = {
  user_id: string;
  role: string;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

interface TaskAssigneesProps {
  task: TaskWithRelations;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  workspaceId: string;
  onChanged: () => void;
}

export function TaskAssignees({
  task,
  setTask,
  workspaceId,
  onChanged,
}: TaskAssigneesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  const loadMembers = async () => {
    const data = await getWorkspaceMembers(workspaceId);
    setMembers(data as WorkspaceMember[]);
  };

  const assignees = task.assignees || [];
  const assignedUserIds = assignees.map((a) => a.user_id);

  const filteredMembers = members.filter((m) => {
    const name = m.profiles.full_name?.toLowerCase() || "";
    const email = m.profiles.email?.toLowerCase() || "";
    const query = search.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const handleToggleAssignee = async (member: WorkspaceMember) => {
    const isAssigned = assignedUserIds.includes(member.user_id);
    const oldAssignees = [...assignees];

    if (isAssigned) {
      // Optimistic remove
      setTask((prev) =>
        prev
          ? {
              ...prev,
              assignees: prev.assignees?.filter((a) => a.user_id !== member.user_id),
            }
          : prev
      );
      onChanged();

      const result = await removeAssignee(task.id, member.user_id);
      if (!result.success) {
        setTask((prev) => (prev ? { ...prev, assignees: oldAssignees } : prev));
      }
    } else {
      // Optimistic add
      const newAssignee = {
        id: `temp-${Date.now()}`,
        user_id: member.user_id,
        profiles: member.profiles,
      };
      setTask((prev) =>
        prev
          ? {
              ...prev,
              assignees: [...(prev.assignees || []), newAssignee],
            }
          : prev
      );
      onChanged();

      const result = await addAssignee(task.id, member.user_id);
      if (!result.success) {
        setTask((prev) => (prev ? { ...prev, assignees: oldAssignees } : prev));
      }
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
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Users className="h-4 w-4" />
        Assignees
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
          </div>
        ))}

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
                          <AvatarImage src={member.profiles.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.profiles.full_name, member.profiles.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-left text-sm truncate">
                          {member.profiles.full_name || member.profiles.email}
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
      </div>
    </div>
  );
}
