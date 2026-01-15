"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, MoreHorizontal, Pencil, Trash2, Archive, RotateCcw, Loader2 } from "lucide-react";
import { type Board, type BoardSummary } from "@/lib/actions/boards";
import { useArchiveBoard, useUnarchiveBoard } from "@/lib/query/mutations/boards";
import { cn } from "@/lib/utils";
import { EditBoardDialog } from "./edit-board-dialog";
import { DeleteBoardDialog } from "./delete-board-dialog";

interface BoardCardProps {
  board: Board | BoardSummary;
  workspaceId: string;
}

export function BoardCard({ board, workspaceId }: BoardCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const archiveBoardMutation = useArchiveBoard();
  const unarchiveBoardMutation = useUnarchiveBoard();

  const handleCardClick = () => {
    router.push(`/${workspaceId}/${board.id}`);
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await archiveBoardMutation.mutateAsync(board.id);
    } catch (error) {
      // Error is handled by React Query
    }
  };

  const handleUnarchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await unarchiveBoardMutation.mutateAsync(board.id);
    } catch (error) {
      // Error is handled by React Query
    }
  };

  return (
    <>
      <Card
        className={cn(
          "h-full bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer group",
          board.archived && "opacity-60 border-dashed"
        )}
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                board.archived ? "bg-muted" : "bg-primary/10 group-hover:bg-primary/20"
              )}>
                {board.archived ? (
                  <Archive className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <LayoutDashboard className="w-5 h-5 text-primary" />
                )}
              </div>
              {board.archived && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Archived
                </span>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {board.archived ? (
                  <DropdownMenuItem onClick={handleUnarchive} disabled={unarchiveBoardMutation.isPending}>
                    {unarchiveBoardMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleArchive} disabled={archiveBoardMutation.isPending}>
                    {archiveBoardMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="mr-2 h-4 w-4" />
                    )}
                    Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardTitle className="text-lg group-hover:text-primary transition-colors">
            {board.name}
          </CardTitle>
          {board.description && (
            <CardDescription className="line-clamp-2">
              {board.description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

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
    </>
  );
}
