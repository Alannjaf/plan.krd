"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { chatWithDocument, extractPdfContent, type ChatMessage as ChatMessageType } from "@/lib/actions/ai";
import { type Attachment } from "@/lib/actions/attachments";
import {
  Bot,
  Send,
  Loader2,
  FileText,
  MessageSquare,
  AlertCircle,
} from "lucide-react";

interface DocumentChatProps {
  attachment: Attachment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentChat({
  attachment,
  open,
  onOpenChange,
}: DocumentChatProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Extract document content when dialog opens
  useEffect(() => {
    if (open && !documentContent && !isExtracting && !extractionError) {
      extractDocument();
    }
  }, [open]);

  // Focus input when ready
  useEffect(() => {
    if (open && documentContent && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, documentContent]);

  const extractDocument = async () => {
    setIsExtracting(true);
    setExtractionError(null);

    try {
      // Extract text from PDF using server action
      const result = await extractPdfContent(attachment.file_path);

      if (result.success && result.text) {
        setDocumentContent(result.text);
        setPageCount(result.pageCount || null);
      } else {
        setExtractionError(result.error || "Failed to extract document content");
      }
    } catch (err) {
      setExtractionError("Something went wrong while processing the document");
      console.error("Document extraction error:", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !documentContent) return;

    const userMessage: ChatMessageType = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await chatWithDocument(
        documentContent,
        userMessage.content,
        messages
      );

      if (result.success && result.response) {
        const assistantMessage: ChatMessageType = {
          role: "assistant",
          content: result.response,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessageType = {
          role: "assistant",
          content: `Sorry, I couldn't process your question. ${result.error || "Please try again."}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err) {
      console.error("Document chat error:", err);
      const errorMessage: ChatMessageType = {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setMessages([]);
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl h-[600px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Chat with Document
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="truncate">{attachment.file_name}</span>
            {pageCount && (
              <span className="text-xs text-muted-foreground">
                ({pageCount} page{pageCount !== 1 ? "s" : ""})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isExtracting ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Extracting document content...
            </p>
          </div>
        ) : extractionError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-medium mb-1">Could not process document</p>
              <p className="text-sm text-muted-foreground">{extractionError}</p>
            </div>
            <Button variant="outline" onClick={extractDocument}>
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-6" ref={scrollRef}>
              <div className="py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Bot className="w-6 h-6 text-primary" />
                    </div>
                    <h4 className="font-medium mb-2">
                      Ask questions about this document
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      I've read the document and can answer your questions about it.
                    </p>
                    <div className="space-y-2 max-w-sm mx-auto">
                      <SuggestionButton
                        onClick={(q) => {
                          setInput(q);
                          inputRef.current?.focus();
                        }}
                        text="What is this document about?"
                      />
                      <SuggestionButton
                        onClick={(q) => {
                          setInput(q);
                          inputRef.current?.focus();
                        }}
                        text="Summarize the key points"
                      />
                      <SuggestionButton
                        onClick={(q) => {
                          setInput(q);
                          inputRef.current?.focus();
                        }}
                        text="What are the main conclusions?"
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
                      <ChatMessage role="assistant" content="" isStreaming />
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this document..."
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
          </>
        )}
      </DialogContent>
    </Dialog>
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
