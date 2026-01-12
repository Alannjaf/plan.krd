"use client";

import { cn } from "@/lib/utils";
import { Bot, User, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  isStreaming,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg",
        isUser ? "bg-primary/10" : "bg-secondary/50"
      )}
    >
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {isUser ? "You" : "AI Assistant"}
          </span>
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {format(new Date(timestamp), "h:mm a")}
            </span>
          )}
        </div>
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
          {isStreaming && !content ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          ) : (
            <MessageContent content={content} />
          )}
          {isStreaming && content && (
            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        // Handle bullet points
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={index} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{formatInlineStyles(line.slice(2))}</span>
            </div>
          );
        }
        // Handle numbered lists
        const numberedMatch = line.match(/^(\d+)\.\s(.+)$/);
        if (numberedMatch) {
          return (
            <div key={index} className="flex gap-2">
              <span className="text-muted-foreground">{numberedMatch[1]}.</span>
              <span>{formatInlineStyles(numberedMatch[2])}</span>
            </div>
          );
        }
        // Handle headers
        if (line.startsWith("### ")) {
          return (
            <h4 key={index} className="font-semibold text-sm mt-2">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={index} className="font-semibold mt-2">
              {line.slice(3)}
            </h3>
          );
        }
        // Empty lines
        if (!line.trim()) {
          return <div key={index} className="h-2" />;
        }
        // Regular text
        return (
          <p key={index} className="leading-relaxed">
            {formatInlineStyles(line)}
          </p>
        );
      })}
    </div>
  );
}

function formatInlineStyles(text: string): React.ReactNode {
  // Handle **bold**, *italic*, and `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(
        <em key={key++} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Check for code
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-secondary text-xs font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Take the next character
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts;
}
