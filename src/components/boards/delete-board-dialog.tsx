"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type Board, type BoardSummary } from "@/lib/actions/boards";
import { useDeleteBoard } from "@/lib/query/mutations/boards";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface DeleteBoardDialogProps {
  board: Board | BoardSummary;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteBoardDialog({
  board,
  workspaceId,
  open,
  onOpenChange,
}: DeleteBoardDialogProps) {
  const router = useRouter();
  const deleteBoardMutation = useDeleteBoard();

  const handleDelete = async () => {
    try {
      await deleteBoardMutation.mutateAsync(board.id);
      onOpenChange(false);
      router.push(`/${workspaceId}`);
    } catch (error) {
      // Error is handled by React Query
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Board</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{board.name}</strong>?
            This action cannot be undone. All lists and tasks in this board
            will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteBoardMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteBoardMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteBoardMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Board"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
