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
import { useCreateList } from "@/lib/query/mutations/lists";
import type { List } from "@/lib/actions/lists";

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  onListCreated: (list: List) => void;
}

export function CreateListDialog({
  open,
  onOpenChange,
  boardId,
  onListCreated,
}: CreateListDialogProps) {
  const [name, setName] = useState("");
  const createListMutation = useCreateList();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !boardId) return;

    try {
      const list = await createListMutation.mutateAsync({
        boardId,
        name: name.trim(),
      });
      onListCreated(list);
      setName("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create list:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create List</DialogTitle>
          <DialogDescription>
            Add a new column to your Kanban board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">List Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., To Do, In Progress, Done"
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
            <Button type="submit" disabled={!name.trim() || createListMutation.isPending}>
              {createListMutation.isPending ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
