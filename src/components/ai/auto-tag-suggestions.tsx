"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { suggestTagsAndPriority, type AutoTagSuggestion } from "@/lib/actions/ai";
import { Sparkles, Loader2, Check, Flag, Calendar, User, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface AutoTagSuggestionsProps {
  title: string;
  description: string | null;
  boardId: string;
  listId?: string;
  currentPriority: string | null;
  currentLabels: string[];
  currentLabelIds?: string[];
  currentDueDate?: string | null;
  currentAssignees?: string[]; // User IDs
  onApplyPriority: (priority: "low" | "medium" | "high" | "urgent") => void;
  onApplyLabel: (labelName: string) => void;
  onApplyAssignee?: (userId: string) => void;
  onApplyDueDate?: (dueDate: string) => void;
  onApplyCustomField?: (fieldId: string, value: string) => void;
  workspaceMembers?: Array<{ id: string; name: string; email?: string | null }>;
  customFields?: Array<{ id: string; name: string; field_type: string; options?: string[] }>;
  disabled?: boolean;
}

const priorityColors = {
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function AutoTagSuggestions({
  title,
  description,
  boardId,
  listId,
  currentPriority,
  currentLabels,
  currentLabelIds,
  currentDueDate,
  currentAssignees = [],
  onApplyPriority,
  onApplyLabel,
  onApplyAssignee,
  onApplyDueDate,
  onApplyCustomField,
  workspaceMembers = [],
  customFields = [],
  disabled = false,
}: AutoTagSuggestionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AutoTagSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedPriority, setAppliedPriority] = useState(false);
  const [appliedLabels, setAppliedLabels] = useState<Set<string>>(new Set());
  const [appliedAssignees, setAppliedAssignees] = useState<Set<string>>(new Set());
  const [appliedDueDate, setAppliedDueDate] = useState(false);
  const [appliedCustomFields, setAppliedCustomFields] = useState<Set<string>>(new Set());

  // Reset applied state when suggestions change
  useEffect(() => {
    setAppliedPriority(false);
    setAppliedLabels(new Set());
    setAppliedAssignees(new Set());
    setAppliedDueDate(false);
    setAppliedCustomFields(new Set());
  }, [suggestion]);

  const handleGenerate = async () => {
    if (!title.trim()) {
      setError("Task title is required to generate suggestions");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const result = await suggestTagsAndPriority(
        title,
        description,
        boardId,
        listId,
        currentLabelIds
      );

      if (result.success && result.suggestion) {
        setSuggestion(result.suggestion);
      } else {
        setError(result.error || "Failed to generate suggestions");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Auto-tag error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !suggestion && !isLoading) {
      handleGenerate();
    }
  };

  const handleApplyPriority = () => {
    if (suggestion?.priority) {
      onApplyPriority(suggestion.priority);
      setAppliedPriority(true);
    }
  };

  const handleApplyLabel = (label: string) => {
    onApplyLabel(label);
    setAppliedLabels((prev) => new Set(prev).add(label));
  };

  const handleApplyAssignee = (userId: string) => {
    onApplyAssignee?.(userId);
    setAppliedAssignees((prev) => new Set(prev).add(userId));
  };

  const handleApplyDueDate = () => {
    if (suggestion?.due_date) {
      onApplyDueDate?.(suggestion.due_date);
      setAppliedDueDate(true);
    }
  };

  const handleApplyCustomField = (fieldId: string, value: string) => {
    onApplyCustomField?.(fieldId, value);
    setAppliedCustomFields((prev) => new Set(prev).add(fieldId));
  };

  const isPriorityAlreadySet = currentPriority === suggestion?.priority;
  const isDueDateAlreadySet = currentDueDate === suggestion?.due_date;
  const hasSuggestions =
    suggestion &&
    (suggestion.priority ||
      suggestion.labels.length > 0 ||
      (suggestion.assignees && suggestion.assignees.length > 0) ||
      suggestion.due_date ||
      (suggestion.custom_fields && Object.keys(suggestion.custom_fields).length > 0));

  const getMemberName = (userId: string) => {
    const member = workspaceMembers.find((m) => m.id === userId);
    return member?.name || "Unknown";
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !title.trim()}
          className="gap-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Suggestions
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-sm">AI Suggestions</h4>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Analyzing task...</p>
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
          ) : hasSuggestions ? (
            <div className="space-y-4">
              {/* Priority Suggestion */}
              {suggestion.priority && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Suggested Priority
                  </label>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1",
                        priorityColors[suggestion.priority]
                      )}
                    >
                      <Flag className="h-3 w-3" />
                      {suggestion.priority}
                    </Badge>
                    {isPriorityAlreadySet || appliedPriority ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        Applied
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleApplyPriority}
                        className="h-7 text-xs"
                      >
                        Apply
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Label Suggestions */}
              {suggestion.labels.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Suggested Labels
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.labels.map((label) => {
                      const isApplied =
                        appliedLabels.has(label) ||
                        currentLabels.some(
                          (l) => l.toLowerCase() === label.toLowerCase()
                        );
                      return (
                        <div
                          key={label}
                          className="flex items-center gap-1 bg-secondary/50 rounded-md pl-2 pr-1 py-1"
                        >
                          <span className="text-xs">{label}</span>
                          {isApplied ? (
                            <Check className="h-3 w-3 text-green-500 ml-1" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleApplyLabel(label)}
                              className="h-5 w-5 ml-1"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Assignee Suggestions */}
              {suggestion.assignees && suggestion.assignees.length > 0 && onApplyAssignee && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Suggested Assignees
                  </label>
                  <div className="space-y-1.5">
                    {suggestion.assignees.map((userId) => {
                      const isApplied =
                        appliedAssignees.has(userId) || currentAssignees.includes(userId);
                      return (
                        <div
                          key={userId}
                          className="flex items-center justify-between p-2 rounded-md bg-secondary/30"
                        >
                          <span className="text-xs">{getMemberName(userId)}</span>
                          {isApplied ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApplyAssignee(userId)}
                              className="h-6 text-xs"
                            >
                              Apply
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Deadline Suggestion */}
              {suggestion.due_date && onApplyDueDate && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Suggested Deadline
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{formatDate(suggestion.due_date)}</span>
                    {isDueDateAlreadySet || appliedDueDate ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        Applied
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleApplyDueDate}
                        className="h-7 text-xs"
                      >
                        Apply
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Field Suggestions */}
              {suggestion.custom_fields &&
                Object.keys(suggestion.custom_fields).length > 0 &&
                onApplyCustomField && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Suggested Custom Fields
                    </label>
                    <div className="space-y-1.5">
                      {Object.entries(suggestion.custom_fields).map(([fieldId, value]) => {
                        const field = customFields.find((f) => f.id === fieldId);
                        const isApplied = appliedCustomFields.has(fieldId);
                        if (!field) return null;
                        return (
                          <div
                            key={fieldId}
                            className="flex items-center justify-between p-2 rounded-md bg-secondary/30"
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{field.name}</span>
                              <span className="text-xs text-muted-foreground">{value}</span>
                            </div>
                            {isApplied ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApplyCustomField(fieldId, value)}
                                className="h-6 text-xs"
                              >
                                Apply
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Reasoning */}
              {suggestion.reasoning && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {suggestion.reasoning}
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="w-full"
              >
                Regenerate
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                No suggestions available for this task.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
