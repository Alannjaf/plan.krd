"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { summarizeContent } from "@/lib/actions/ai";
import { Sparkles, Loader2, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryButtonProps {
  content: string;
  className?: string;
  minLength?: number;
}

export function SummaryButton({
  content,
  className,
  minLength = 500,
}: SummaryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Don't show button if content is too short
  if (!content || content.length < minLength) {
    return null;
  }

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Strip HTML tags for plain text summarization
      const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const result = await summarizeContent(plainText);

      if (result.success && result.summary) {
        setSummary(result.summary);
      } else {
        setError(result.error || "Failed to generate summary");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Summary error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !summary && !isLoading) {
      handleGenerate();
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
          <Sparkles className="h-3 w-3" />
          Summarize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-sm">AI Summary</h4>
            </div>
            <div className="flex items-center gap-1">
              {summary && !isLoading && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleGenerate}
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
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
          ) : summary ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generating summary...
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
