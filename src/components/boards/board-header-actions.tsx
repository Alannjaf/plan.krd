"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Settings2 } from "lucide-react";
import type { Board } from "@/lib/actions/boards";
import { EditBoardDialog } from "./edit-board-dialog";
import { DeleteBoardDialog } from "./delete-board-dialog";
import { CustomFieldsSettings } from "./custom-fields-settings";

interface BoardHeaderActionsProps {
  board: Board;
  workspaceId: string;
}

export function BoardHeaderActions({ board, workspaceId }: BoardHeaderActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCustomFieldsDialog, setShowCustomFieldsDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Board options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Board
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowCustomFieldsDialog(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Custom Fields
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditBoardDialog
        board={board}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <DeleteBoardDialog
        board={board}
        workspaceId={workspaceId}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />

      <Dialog open={showCustomFieldsDialog} onOpenChange={setShowCustomFieldsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Board Settings</DialogTitle>
          </DialogHeader>
          <CustomFieldsSettings boardId={board.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}
