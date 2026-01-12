"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import {
  chatWithAssistant,
  type ChatMessage as ChatMessageType,
} from "@/lib/actions/ai";
import {
  Bot,
  X,
  Send,
  Loader2,
  Minimize2,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const params = useParams();
  const queryClient = useQueryClient();
  const workspaceId = params?.workspaceId as string | undefined;
  const boardId = params?.boardId as string | undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: ChatMessageType = {
        role: "user",
        content: input.trim(),
        timestamp: new Date().toISOString(),
      };

      // Add user message to state
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);
      setError(null);
      
      // Focus input after clearing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);

      try {
        // Pass the current messages (without the new user message which is already in updatedMessages)
        const result = await chatWithAssistant(userMessage.content, messages, {
          workspaceId,
          boardId,
        });

        // Always add assistant response if we got one (success or error)
        if (result.response) {
          // Check if this is a CSV report response
          try {
            const parsedResponse = JSON.parse(result.response);
            if (parsedResponse.type === "csvReport" && parsedResponse.csv) {
              // Handle CSV download
              const blob = new Blob([parsedResponse.csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `tasks-report-${new Date().toISOString().split("T")[0]}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);

              // Add message with download confirmation
              const assistantMessage: ChatMessageType = {
                role: "assistant",
                content: parsedResponse.message || "✅ CSV report generated and downloaded",
                timestamp: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMessage]);
            } else {
              // Regular response
              const assistantMessage: ChatMessageType = {
                role: "assistant",
                content: result.response,
                timestamp: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMessage]);
            }
          } catch {
            // Not JSON, treat as regular response
            const assistantMessage: ChatMessageType = {
              role: "assistant",
              content: result.response,
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
          }

          // If an action was executed successfully, invalidate queries to refresh the board
          if (result.actionExecuted) {
            // Invalidate all task-related queries - this is faster than router.refresh()
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["lists"] });
            queryClient.invalidateQueries({ queryKey: ["board"] });
          }
        } else if (!result.success) {
          // Only show error banner if we got no response at all
          setError(result.error || "Failed to get response from AI");
        }
      } catch (err) {
        setError("Something went wrong. Please try again.");
        console.error("Chat error:", err);
      } finally {
        setIsLoading(false);
        // Focus input after loading completes
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    },
    [input, isLoading, messages, workspaceId, boardId, queryClient]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  // Context indicator
  const contextLabel = boardId
    ? "Board context"
    : workspaceId
      ? "Workspace context"
      : "Global";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-200",
          "bg-primary text-primary-foreground hover:scale-105 active:scale-95",
          "flex items-center justify-center",
          isOpen && "scale-0 opacity-0"
        )}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed z-50 bg-card border rounded-xl shadow-2xl transition-all duration-300 flex flex-col",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          isExpanded
            ? "bottom-4 right-4 left-4 top-20 md:left-auto md:w-[600px] md:top-20"
            : "bottom-6 right-6 w-[380px] h-[500px]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">AI Assistant</h3>
              <p className="text-xs text-muted-foreground">{contextLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        {/* Messages container with native scroll */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        >
          <div className="py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-medium mb-2">How can I help you?</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask about tasks or manage them with natural language!
                </p>
                <div className="space-y-2">
                  <SuggestionButton
                    onClick={(q) => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    text="Show me tasks due this week"
                  />
                  <SuggestionButton
                    onClick={(q) => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    text="Create a task to review the homepage"
                  />
                  <SuggestionButton
                    onClick={(q) => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    text="What are my high priority tasks?"
                  />
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                  />
                ))}
                {isLoading && (
                  <ChatMessage
                    role="assistant"
                    content=""
                    isStreaming
                  />
                )}
              </>
            )}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t shrink-0">
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-xs h-7"
              >
                Clear chat
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

function SuggestionButton({
  text,
  onClick,
}: {
  text: string;
  onClick: (text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="w-full text-left px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-sm transition-colors"
    >
      {text}
    </button>
  );
}
