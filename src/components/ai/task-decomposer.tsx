"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { decomposeTask, type DecomposedSubtask } from "@/lib/actions/ai";
import { useCreateSubtask } from "@/lib/query/mutations/subtasks";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskDecomposerProps {
  taskId: string;
  onSubtasksCreated: () => void;
  disabled?: boolean;
}

export function TaskDecomposer({
  taskId,
  onSubtasksCreated,
  disabled = false,
}: TaskDecomposerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<DecomposedSubtask[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  const createSubtaskMutation = useCreateSubtask();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSubtasks([]);
    setSelectedIds(new Set());

    try {
      const result = await decomposeTask(taskId);

      if (result.success && result.subtasks) {
        setSubtasks(result.subtasks);
        // Select all by default
        setSelectedIds(new Set(result.subtasks.map((_, i) => i)));
      } else {
        setError(result.error || "Failed to generate subtasks");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Decompose error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleSelection = (index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === subtasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subtasks.map((_, i) => i)));
    }
  };

  const handleCreateSubtasks = async () => {
    if (selectedIds.size === 0) return;

    setIsCreating(true);
    setError(null);

    try {
      const selectedSubtasks = subtasks.filter((_, i) => selectedIds.has(i));

      // Create subtasks sequentially to maintain order using React Query mutation
      for (const subtask of selectedSubtasks) {
        await createSubtaskMutation.mutateAsync({ taskId, title: subtask.title });
      }

      onSubtasksCreated();
      setIsOpen(false);
      setSubtasks([]);
      setSelectedIds(new Set());
    } catch (err) {
      setError("Failed to create some subtasks. Please try again.");
      console.error("Create subtasks error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Auto-generate on open
      handleGenerate();
    } else {
      // Reset state on close
      setSubtasks([]);
      setSelectedIds(new Set());
      setError(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
        className="gap-2"
      >
        <Wand2 className="h-3.5 w-3.5" />
        Break down with AI
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Task Decomposer
            </DialogTitle>
            <DialogDescription>
              AI will analyze your task and suggest subtasks to break it down into manageable pieces.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">
                  Analyzing task and generating subtasks...
                </p>
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            ) : subtasks.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedIds.size} of {subtasks.length} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs h-7"
                  >
                    {selectedIds.size === subtasks.length
                      ? "Deselect all"
                      : "Select all"}
                  </Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {subtasks.map((subtask, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                        selectedIds.has(index)
                          ? "bg-primary/5 border-primary/30"
                          : "bg-secondary/30 border-border hover:bg-secondary/50"
                      )}
                      onClick={() => handleToggleSelection(index)}
                    >
                      <Checkbox
                        checked={selectedIds.has(index)}
                        onCheckedChange={() => handleToggleSelection(index)}
                        className="mt-0.5"
                      />
                      <span className="text-sm flex-1">{subtask.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Click the button below to generate subtasks</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {subtasks.length > 0 && !isGenerating && (
              <>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isCreating}
                >
                  Regenerate
                </Button>
                <Button
                  onClick={handleCreateSubtasks}
                  disabled={selectedIds.size === 0 || isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    `Add ${selectedIds.size} Subtask${selectedIds.size !== 1 ? "s" : ""}`
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
