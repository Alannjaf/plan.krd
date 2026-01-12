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
import { type Board } from "@/lib/actions/boards";
import { useUpdateBoard } from "@/lib/query/mutations/boards";
import { Loader2 } from "lucide-react";

interface EditBoardDialogProps {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBoardDialog({
  board,
  open,
  onOpenChange,
}: EditBoardDialogProps) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || "");
  const updateBoardMutation = useUpdateBoard();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await updateBoardMutation.mutateAsync({
        boardId: board.id,
        updates: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch (error) {
      // Error is handled by React Query
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Board</DialogTitle>
          <DialogDescription>
            Update your board details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Board Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Product Roadmap"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this board for?"
              />
            </div>
            {updateBoardMutation.isError && (
              <p className="text-sm text-destructive">
                {updateBoardMutation.error instanceof Error
                  ? updateBoardMutation.error.message
                  : "Failed to update board"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || updateBoardMutation.isPending}>
              {updateBoardMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
