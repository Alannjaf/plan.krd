"use client";

import { useState } from "react";
import { BoardCard } from "./board-card";
import { CreateBoardDialog } from "./create-board-dialog";
import { Button } from "@/components/ui/button";
import { type Board, type BoardSummary, getBoardsSummary } from "@/lib/actions/boards";
import { LayoutDashboard, Archive, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceBoardsProps {
  workspaceId: string;
  initialBoards: BoardSummary[];
}

export function WorkspaceBoards({ workspaceId, initialBoards }: WorkspaceBoardsProps) {
  const [boards, setBoards] = useState(initialBoards);
  const [archivedBoards, setArchivedBoards] = useState<BoardSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);

  const activeBoards = boards.filter((b) => !b.archived);

  const handleToggleArchived = async () => {
    if (!showArchived && archivedBoards.length === 0) {
      // Fetch archived boards
      setIsLoadingArchived(true);
      const allBoards = await getBoardsSummary(workspaceId, true);
      const archived = allBoards.filter((b) => b.archived);
      setArchivedBoards(archived);
      setIsLoadingArchived(false);
    }
    setShowArchived(!showArchived);
  };

  return (
    <div className="space-y-8">
      {activeBoards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border/50 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <LayoutDashboard className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No boards yet</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-6">
            Create your first board to start organizing tasks with Kanban,
            lists, and more.
          </p>
          <CreateBoardDialog workspaceId={workspaceId} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeBoards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}

      {/* Archived Boards Section */}
      <div className="border-t border-border/50 pt-6">
        <Button
          variant="ghost"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={handleToggleArchived}
          disabled={isLoadingArchived}
        >
          {showArchived ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Archive className="h-4 w-4" />
          Archived Boards
          {archivedBoards.length > 0 && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {archivedBoards.length}
            </span>
          )}
        </Button>

        {showArchived && (
          <div className="mt-4">
            {isLoadingArchived ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : archivedBoards.length === 0 ? (
              <div className="text-sm text-muted-foreground pl-6">
                No archived boards
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-6">
                {archivedBoards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    workspaceId={workspaceId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
