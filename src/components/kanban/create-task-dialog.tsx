"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateTask } from "@/lib/query/mutations/tasks";
import type { TaskWithRelations } from "@/lib/actions/tasks";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  onTaskCreated: (task: TaskWithRelations) => void;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  listId,
  onTaskCreated,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const createTaskMutation = useCreateTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !listId) return;

    try {
      const task = await createTaskMutation.mutateAsync({
        listId,
        title: title.trim(),
      });

      // Create a TaskWithRelations object with empty relations
      const taskWithRelations: TaskWithRelations = {
        ...task,
        archived: false,
        archived_at: null,
        assignees: [],
        labels: [],
        subtasks: [],
        custom_field_values: [],
        attachments_count: 0,
        comments_count: 0,
      };
      onTaskCreated(taskWithRelations);
      setTitle("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task to this list. You can add more details later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createTaskMutation.isPending}>
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
