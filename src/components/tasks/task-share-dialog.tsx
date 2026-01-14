"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateTaskShareToken, revokeTaskShareToken, isTaskShareEnabled } from "@/lib/actions/tasks";
import { Loader2, Copy, Check, Share2, Lock } from "lucide-react";

interface TaskShareDialogProps {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskShareDialog({
  taskId,
  open,
  onOpenChange,
}: TaskShareDialogProps) {
  const [isShared, setIsShared] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check share status on mount/open
  useEffect(() => {
    if (open && taskId) {
      checkShareStatus();
    }
  }, [open, taskId]);

  const checkShareStatus = async () => {
    if (!taskId || taskId.startsWith("temp-")) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const result = await isTaskShareEnabled(taskId);
    if (result.success && result.isShared && result.token) {
      setIsShared(true);
      setShareUrl(`${window.location.origin}/task/${result.token}`);
    } else {
      setIsShared(false);
      setShareUrl("");
    }
    setIsChecking(false);
  };

  const handleToggleShare = async (enabled: boolean) => {
    if (enabled && !isShared) {
      // Generate token
      setIsLoading(true);
      const result = await generateTaskShareToken(taskId);
      setIsLoading(false);

      if (result.success && result.token) {
        setIsShared(true);
        setShareUrl(`${window.location.origin}/task/${result.token}`);
        setMessage({ type: "success", text: "Share link generated. Your task is now shareable." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to generate share link" });
        setTimeout(() => setMessage(null), 3000);
      }
    } else if (!enabled && isShared) {
      // Revoke token
      setIsLoading(true);
      const result = await revokeTaskShareToken(taskId);
      setIsLoading(false);

      if (result.success) {
        setIsShared(false);
        setShareUrl("");
        setMessage({ type: "success", text: "Sharing disabled. Your task is no longer shareable." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to revoke share link" });
        setTimeout(() => setMessage(null), 3000);
      }
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setMessage({ type: "success", text: "Link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to copy link to clipboard" });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsShared(false);
      setShareUrl("");
      setCopied(false);
      setMessage(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Task</DialogTitle>
          <DialogDescription>
            Generate a shareable link for this task. Anyone with the link can view it (authentication required).
          </DialogDescription>
        </DialogHeader>

        {isChecking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Message Banner */}
            {message && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  message.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                }`}
              >
                {message.text}
              </div>
            )}
            {/* Toggle Switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="share-toggle" className="text-base">
                  Enable sharing
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow authenticated users with the link to view this task
                </p>
              </div>
              <Switch
                id="share-toggle"
                checked={isShared}
                onCheckedChange={handleToggleShare}
                disabled={isLoading}
              />
            </div>

            {/* Share Link */}
            {isShared && shareUrl && (
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="pr-10 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    disabled={!shareUrl}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with anyone. They will need to sign in to view the task.
                </p>
              </div>
            )}

            {!isShared && !isLoading && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Not Shared</p>
                    <p className="text-xs text-muted-foreground">
                      This task is currently private. Enable sharing to generate a shareable link.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
