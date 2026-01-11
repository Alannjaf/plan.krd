"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceMembers } from "@/lib/query/queries/members";
import { cn } from "@/lib/utils";

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

interface MentionPopoverProps {
  workspaceId: string;
  trigger: React.ReactNode;
  onSelect: (userId: string, name: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MentionPopover({
  workspaceId,
  trigger,
  onSelect,
  open,
  onOpenChange,
}: MentionPopoverProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const { data: membersData = [] } = useWorkspaceMembers(workspaceId);
  const members = membersData as unknown as Member[];

  const filteredMembers = members.filter((member) => {
    if (!search) return true;
    const name = member.profiles?.full_name || member.profiles?.email || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  const handleSelect = (member: Member) => {
    const name = member.profiles?.full_name || member.profiles?.email || "";
    onSelect(member.user_id, name);
    onOpenChange(false);
    setSearch("");
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredMembers[selectedIndex]) {
        handleSelect(filteredMembers[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onKeyDown={handleKeyDown}
      >
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[200px]">
          {filteredMembers.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No members found
            </div>
          ) : (
            <div className="py-1">
              {filteredMembers.map((member, index) => {
                const name = member.profiles?.full_name || member.profiles?.email || "Unknown";
                return (
                  <div
                    key={member.user_id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted transition-colors",
                      index === selectedIndex && "bg-muted"
                    )}
                    onClick={() => handleSelect(member)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.profiles?.full_name || null, member.profiles?.email || null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{name}</div>
                      {member.profiles?.email && member.profiles?.full_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {member.profiles.email}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
