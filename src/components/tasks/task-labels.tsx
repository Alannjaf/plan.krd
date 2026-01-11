"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getLabels,
  createLabel,
  addLabelToTask,
  removeLabelFromTask,
  type Label,
} from "@/lib/actions/labels";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queries/tasks";
import { Tags, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskLabelsProps {
  task: TaskWithRelations;
  boardId: string;
  onChanged: () => void;
}

const defaultColors = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export function TaskLabels({
  task,
  boardId,
  onChanged,
}: TaskLabelsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [boardLabels, setBoardLabels] = useState<Label[]>([]);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(defaultColors[0]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      loadLabels();
    }
  }, [isOpen]);

  const loadLabels = async () => {
    const data = await getLabels(boardId);
    setBoardLabels(data);
  };

  const labels = task.labels || [];
  const assignedLabelIds = labels.map((l) => l.label_id);

  const filteredLabels = boardLabels.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleLabel = async (label: Label) => {
    const isAssigned = assignedLabelIds.includes(label.id);
    onChanged();

    if (isAssigned) {
      const result = await removeLabelFromTask(task.id, label.id);
      if (result.success) {
        // Invalidate queries to refetch updated task data
        queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard(boardId) });
      }
    } else {
      const result = await addLabelToTask(task.id, label.id);
      if (result.success) {
        // Invalidate queries to refetch updated task data
        queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard(boardId) });
      }
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;

    const result = await createLabel(boardId, newLabelName.trim(), newLabelColor);
    if (result.success && result.label) {
      onChanged();

      const addResult = await addLabelToTask(task.id, result.label.id);
      if (addResult.success) {
        // Invalidate queries to refetch updated task data
        queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard(boardId) });
      }
      loadLabels();
    }
    setNewLabelName("");
    setIsCreating(false);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Tags className="h-4 w-4" />
        Labels
      </div>

      <div className="flex flex-wrap gap-1">
        {labels.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: label.labels?.color }}
          >
            {label.labels?.name}
            <button
              className="hover:opacity-70 transition-opacity"
              onClick={() =>
                handleToggleLabel({
                  id: label.label_id,
                  board_id: boardId,
                  name: label.labels?.name || "",
                  color: label.labels?.color || "",
                  created_at: "",
                })
              }
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            {isCreating ? (
              <div className="space-y-2">
                <Input
                  placeholder="Label name"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  autoFocus
                />
                <div className="flex flex-wrap gap-1">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "w-6 h-6 rounded-full transition-transform",
                        newLabelColor === color && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewLabelColor(color)}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateLabel}>
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search labels..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="h-40">
                  {filteredLabels.length === 0 && search ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No labels found
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredLabels.map((label) => {
                        const isAssigned = assignedLabelIds.includes(label.id);
                        return (
                          <button
                            key={label.id}
                            className={cn(
                              "w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 transition-colors",
                              isAssigned && "bg-secondary"
                            )}
                            onClick={() => handleToggleLabel(label)}
                          >
                            <span
                              className="w-4 h-4 rounded-full shrink-0"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="flex-1 text-left text-sm truncate">
                              {label.name}
                            </span>
                            {isAssigned && <Check className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create new label
                </Button>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
