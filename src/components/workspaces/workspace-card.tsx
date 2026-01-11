"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Folder, Users, MoreHorizontal, Pencil, Trash2, Settings } from "lucide-react";
import type { WorkspaceWithMeta } from "@/lib/actions/workspaces";
import { EditWorkspaceDialog } from "./edit-workspace-dialog";
import { DeleteWorkspaceDialog } from "./delete-workspace-dialog";

interface WorkspaceCardProps {
  workspace: WorkspaceWithMeta;
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();

  const isOwner = workspace.current_user_role === "owner";
  const isAdmin = workspace.current_user_role === "admin";
  const canEdit = isOwner || isAdmin;
  const canDelete = isOwner;

  const handleCardClick = () => {
    router.push(`/${workspace.id}`);
  };

  return (
    <>
      <Card
        className="h-full bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer group"
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Folder className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>{workspace.member_count}</span>
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
                  {canEdit && (
                    <DropdownMenuItem asChild>
                      <Link href={`/${workspace.id}/settings`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                  {!canEdit && !canDelete && (
                    <DropdownMenuItem asChild>
                      <Link href={`/${workspace.id}`}>
                        <Folder className="mr-2 h-4 w-4" />
                        Open
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <CardTitle className="text-lg group-hover:text-primary transition-colors">
            {workspace.name}
          </CardTitle>
          {workspace.description && (
            <CardDescription className="line-clamp-2">
              {workspace.description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {canEdit && (
        <EditWorkspaceDialog
          workspace={workspace}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {canDelete && (
        <DeleteWorkspaceDialog
          workspace={workspace}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
        />
      )}
    </>
  );
}
