"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, Sparkles } from "lucide-react";
import { getAssigneeSuggestions, applyAutoAssignment } from "@/lib/actions/ai-automation";
import { toast } from "sonner";

interface AutoAssignmentPanelProps {
  taskId: string;
  onAssigned?: () => void;
}

export function AutoAssignmentPanel({ taskId, onAssigned }: AutoAssignmentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const handleGetSuggestions = async () => {
    setIsLoading(true);
    try {
      const result = await getAssigneeSuggestions(taskId);
      if (result.success && result.suggestions) {
        setSuggestions(result.suggestions);
        setIsOpen(true);
      } else {
        toast.error(result.error || "Failed to get suggestions");
      }
    } catch (error) {
      toast.error("Failed to get suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async (userId: string) => {
    setIsLoading(true);
    try {
      const result = await applyAutoAssignment(taskId, userId);
      if (result.success) {
        toast.success("Task assigned");
        setIsOpen(false);
        if (onAssigned) {
          onAssigned();
        }
      } else {
        toast.error(result.error || "Failed to assign task");
      }
    } catch (error) {
      toast.error("Failed to assign task");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleGetSuggestions}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className="ml-2">AI Suggest Assignee</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Assignment Suggestions</DialogTitle>
            <DialogDescription>
              AI-recommended assignees based on skills, workload, and history
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No suggestions available
              </p>
            ) : (
              suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="p-4 border rounded-lg flex justify-between items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlus className="h-4 w-4" />
                      <span className="font-medium">{suggestion.user_name}</span>
                      <Badge variant="secondary">
                        {(suggestion.confidence * 100).toFixed(0)}% match
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {suggestion.reasoning}
                    </p>
                    {suggestion.match_factors && suggestion.match_factors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {suggestion.match_factors.map((factor: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleAssign(suggestion.user_id)}
                    disabled={isLoading}
                    size="sm"
                  >
                    Assign
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
