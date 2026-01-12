"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { rewriteContent } from "@/lib/actions/ai";
import { Wand2, Loader2, X, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RewriteButtonProps {
  content: string;
  className?: string;
  onApply?: (rewritten: string) => void;
  minLength?: number;
}

export function RewriteButton({
  content,
  className,
  onApply,
  minLength = 20,
}: RewriteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Don't show button if content is too short
  if (!content || content.replace(/<[^>]*>/g, "").trim().length < minLength) {
    return null;
  }

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await rewriteContent(content);

      if (result.success && result.rewritten) {
        setRewritten(result.rewritten);
      } else {
        setError(result.error || "Failed to rewrite content");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Rewrite error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !rewritten && !isLoading) {
      handleGenerate();
    }
  };

  const handleApply = () => {
    if (rewritten && onApply) {
      onApply(rewritten);
      setIsOpen(false);
      setRewritten(null);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1.5 text-xs", className)}
        >
          <Wand2 className="h-3 w-3" />
          Rewrite
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-sm">AI Rewrite</h4>
            </div>
            <div className="flex items-center gap-1">
              {rewritten && !isLoading && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleGenerate}
                  title="Regenerate"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Simplifying content...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          ) : rewritten ? (
            <div className="space-y-3">
              <ScrollArea className="h-[200px] rounded-md border p-3">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: rewritten }}
                />
              </ScrollArea>
              {onApply && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="w-full gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply Rewrite
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generating rewrite...
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
