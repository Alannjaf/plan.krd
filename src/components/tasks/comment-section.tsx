"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getComments,
  createComment,
  type Comment,
} from "@/lib/actions/comments";
import { CommentItem } from "./comment-item";
import { Loader2, Send } from "lucide-react";

interface CommentSectionProps {
  taskId: string;
  workspaceId: string;
  onUpdate: () => void;
}

export function CommentSection({
  taskId,
  workspaceId,
  onUpdate,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const loadComments = async () => {
    setIsLoading(true);
    const data = await getComments(taskId);
    setComments(data);
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    const result = await createComment(taskId, newComment.trim());
    if (result.success) {
      loadComments();
      onUpdate();
    }
    setNewComment("");
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">ME</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder="Write a comment... Use @username to mention someone"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !newComment.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              taskId={taskId}
              onUpdate={() => {
                loadComments();
                onUpdate();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
