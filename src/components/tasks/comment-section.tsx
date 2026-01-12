"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useComments } from "@/lib/query/queries/comments";
import { useWorkspaceMembers } from "@/lib/query/queries/members";
import { useCreateComment } from "@/lib/query/mutations/comments";
import { CommentItem } from "./comment-item";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { SummaryButton } from "@/components/ai/summary-button";

interface CommentSectionProps {
  taskId: string;
  workspaceId: string;
  setTask?: React.Dispatch<React.SetStateAction<unknown>>;
  onChanged?: () => void;
  readOnly?: boolean;
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

export function CommentSection({
  taskId,
  workspaceId,
  readOnly = false,
}: CommentSectionProps) {
  const { data: comments = [], isLoading: commentsLoading } = useComments(taskId);
  const { data: membersData = [] } = useWorkspaceMembers(workspaceId);
  const members = membersData as unknown as Member[];
  const createCommentMutation = useCreateComment();
  
  const [newComment, setNewComment] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredMembers = members.filter((member) => {
    if (!mentionSearch) return true;
    const name = member.profiles?.full_name || member.profiles?.email || "";
    return name.toLowerCase().includes(mentionSearch.toLowerCase());
  });

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  const handleTextChange = (value: string) => {
    setNewComment(value);

    // Check for @ mention trigger
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show if there's no space or newline after @
      if (!textAfterAt.match(/[\s\n]/)) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }

    setShowMentions(false);
    setMentionSearch("");
  };

  const insertMention = (member: Member) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = newComment.slice(0, cursorPos);
    const textAfterCursor = newComment.slice(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const name = member.profiles?.full_name || member.profiles?.email || "";
      const beforeAt = textBeforeCursor.slice(0, lastAtIndex);
      const newText = `${beforeAt}@${name} ${textAfterCursor}`;
      setNewComment(newText);
      setShowMentions(false);
      setMentionSearch("");
      
      // Set cursor position after the inserted mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = beforeAt.length + name.length + 2; // +2 for @ and space
          textareaRef.current.setSelectionRange(newPos, newPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    const commentContent = newComment.trim();
    setNewComment("");
    
    try {
      await createCommentMutation.mutateAsync({
        taskId,
        content: commentContent,
      });
    } catch (error) {
      // Error is handled by React Query
      // Restore comment on error
      setNewComment(commentContent);
    }
  };

  const handleCommentUpdate = () => {
    // Realtime subscriptions handle updates, no need to invalidate
  };

  if (commentsLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Comment Input */}
      {!readOnly && (
        <div className="flex gap-3 shrink-0 mb-4">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">ME</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Write a comment... Use @username to mention someone"
              value={newComment}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (showMentions) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === "Enter" && filteredMembers[mentionIndex]) {
                    e.preventDefault();
                    insertMention(filteredMembers[mentionIndex]);
                  } else if (e.key === "Escape") {
                    setShowMentions(false);
                  }
                }
              }}
              className="min-h-[80px] resize-none"
            />
            {showMentions && (
              <div className="absolute z-50 w-64 mt-2 bg-popover border rounded-md shadow-md">
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
                              index === mentionIndex && "bg-muted"
                            )}
                            onClick={() => insertMention(member)}
                            onMouseEnter={() => setMentionIndex(index)}
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
              </div>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createCommentMutation.isPending || !newComment.trim()}
              >
                {createCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <>
          {/* Comments Header with Summary */}
          {comments.length >= 3 && (
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>{comments.length} comments</span>
              </div>
              <SummaryButton
                content={comments.map((c) => `${c.profiles?.full_name || 'User'}: ${c.content}`).join('\n\n')}
                minLength={300}
              />
            </div>
          )}
          <ScrollArea className="h-[500px]">
            <div className="space-y-4 pr-4 pb-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  taskId={taskId}
                  onUpdate={handleCommentUpdate}
                />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
