"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Trash2, X } from "lucide-react";
import { updateTask, deleteTask, type TaskWithRelations } from "@/lib/actions/tasks";

interface TaskHeaderProps {
  task: TaskWithRelations;
  onUpdate: () => void;
  onClose: () => void;
}

export function TaskHeader({ task, onUpdate, onClose }: TaskHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveTitle = async () => {
    if (title.trim() && title !== task.title) {
      await updateTask(task.id, { title: title.trim() });
      onUpdate();
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteTask(task.id);
    if (result.success) {
      onClose();
      onUpdate();
    }
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold"
              autoFocus
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  setTitle(task.title);
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <h2
              className="text-xl font-semibold cursor-pointer hover:text-primary transition-colors truncate"
              onClick={() => setIsEditing(true)}
            >
              {task.title}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                Edit title
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
