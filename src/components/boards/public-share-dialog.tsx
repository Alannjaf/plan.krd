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
import { generatePublicToken, revokePublicToken, isPublicBoard, type Board } from "@/lib/actions/boards";
import { Loader2, Copy, Check, Globe, Lock } from "lucide-react";

interface PublicShareDialogProps {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicShareDialog({
  board,
  open,
  onOpenChange,
}: PublicShareDialogProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check public status on mount/open
  useEffect(() => {
    if (open) {
      checkPublicStatus();
    }
  }, [open, board.id]);

  const checkPublicStatus = async () => {
    setIsChecking(true);
    const result = await isPublicBoard(board.id);
    if (result.success && result.isPublic) {
      setIsPublic(true);
      if (board.public_token) {
        setPublicUrl(`${window.location.origin}/public/${board.public_token}`);
      }
    } else {
      setIsPublic(false);
      setPublicUrl("");
    }
    setIsChecking(false);
  };

  const handleTogglePublic = async (enabled: boolean) => {
    if (enabled && !isPublic) {
      // Generate token
      setIsLoading(true);
      const result = await generatePublicToken(board.id);
      setIsLoading(false);

      if (result.success && result.token) {
        setIsPublic(true);
        setPublicUrl(`${window.location.origin}/public/${result.token}`);
        setMessage({ type: "success", text: "Public access enabled. Your board is now publicly accessible." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to generate share link" });
        setTimeout(() => setMessage(null), 3000);
      }
    } else if (!enabled && isPublic) {
      // Revoke token
      setIsLoading(true);
      const result = await revokePublicToken(board.id);
      setIsLoading(false);

      if (result.success) {
        setIsPublic(false);
        setPublicUrl("");
        setMessage({ type: "success", text: "Public access disabled. Your board is no longer publicly accessible." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to revoke share link" });
        setTimeout(() => setMessage(null), 3000);
      }
    }
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setMessage({ type: "success", text: "Link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to copy link to clipboard" });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Board</DialogTitle>
          <DialogDescription>
            Generate a public link to share this board. Anyone with the link can view it in read-only mode.
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
                <Label htmlFor="public-toggle" className="text-base">
                  Enable public access
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow anyone with the link to view this board
                </p>
              </div>
              <Switch
                id="public-toggle"
                checked={isPublic}
                onCheckedChange={handleTogglePublic}
                disabled={isLoading}
              />
            </div>

            {/* Share Link */}
            {isPublic && publicUrl && (
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={publicUrl}
                      readOnly
                      className="pr-10 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    disabled={!publicUrl}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This board is publicly accessible. Share this link with anyone to give them read-only access.
                </p>
              </div>
            )}

            {!isPublic && !isLoading && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Private Board</p>
                    <p className="text-xs text-muted-foreground">
                      This board is currently private. Enable public access to generate a shareable link.
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
