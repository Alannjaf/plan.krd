"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { useUpdateTask } from "@/lib/query/mutations/tasks";
import { AlignLeft, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SummaryButton } from "@/components/ai/summary-button";
import { RewriteButton } from "@/components/ai/rewrite-button";

interface TaskDescriptionProps {
  task: TaskWithRelations;
  onChanged: () => void;
  readOnly?: boolean;
  realTaskId?: string | null; // Real task ID if task.id is a temp ID
}

export function TaskDescription({
  task,
  onChanged,
  readOnly = false,
  realTaskId,
}: TaskDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editorContent, setEditorContent] = useState<string>("");
  const updateTaskMutation = useUpdateTask();

  // Use real task ID if available, otherwise use task.id (only if not temp)
  const effectiveTaskId = realTaskId || (task.id.startsWith("temp-") ? null : task.id);
  const isTempId = task.id.startsWith("temp-") && !realTaskId;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Add a more detailed description...",
      }),
    ],
    content: task.description || "",
    immediatelyRender: false, // Prevent SSR hydration mismatch
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] p-3 border rounded-md",
      },
    },
    onUpdate: ({ editor }) => {
      setEditorContent(editor.getHTML());
    },
  });

  // Initialize editor content when editor is ready
  useEffect(() => {
    if (editor) {
      setEditorContent(editor.getHTML());
    }
  }, [editor]);

  // Get the current content to use for AI buttons
  // Use editor content when editing, otherwise use task.description
  const currentContent = isEditing ? editorContent : (task.description || "");
  
  // Helper function to get plain text length (strips HTML)
  const getPlainTextLength = (html: string): number => {
    if (!html) return 0;
    // Strip HTML tags and get text length
    const plainText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return plainText.length;
  };

  const hasContentForRewrite = getPlainTextLength(currentContent) >= 20;
  const hasContentForSummarize = getPlainTextLength(currentContent) >= 300;

  const handleSave = () => {
    if (!editor || !effectiveTaskId) {
      // If we don't have a real task ID yet, cancel editing
      setIsEditing(false);
      return;
    }

    const html = editor.getHTML();
    const newDescription = html === "<p></p>" ? null : html;
    const oldDescription = task.description;

    onChanged();
    setIsEditing(false);
    setEditorContent(newDescription || "");

    updateTaskMutation.mutate(
      { taskId: effectiveTaskId, updates: { description: newDescription } },
      {
        onError: () => {
          // Rollback on error
          editor.commands.setContent(oldDescription || "");
          setEditorContent(oldDescription || "");
        },
      }
    );
  };

  const handleCancel = () => {
    editor?.commands.setContent(task.description || "");
    setEditorContent(task.description || "");
    setIsEditing(false);
  };

  const handleApplyRewrite = (rewritten: string) => {
    if (!effectiveTaskId) {
      console.error("Cannot update task with temporary ID. Please wait for task to be created.");
      return;
    }

    onChanged();
    
    updateTaskMutation.mutate(
      { taskId: effectiveTaskId, updates: { description: rewritten } },
      {
        onError: () => {
          console.error("Failed to apply rewritten description");
        },
      }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <AlignLeft className="h-4 w-4" />
          Description
        </div>
        {hasContentForRewrite && !readOnly && (
          <div className="flex items-center gap-1">
            <RewriteButton
              content={currentContent}
              onApply={handleApplyRewrite}
              minLength={20}
            />
            {hasContentForSummarize && (
              <SummaryButton content={currentContent} minLength={300} />
            )}
          </div>
        )}
        {hasContentForSummarize && readOnly && (
          <SummaryButton content={currentContent} minLength={300} />
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {isTempId && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Waiting for task to be created... Changes will be saved once the task is ready.
            </p>
          )}
          <EditorContent editor={editor} />
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              onClick={handleSave} 
              disabled={updateTaskMutation.isPending || isTempId}
            >
              <Check className="h-4 w-4 mr-1" />
              {updateTaskMutation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "min-h-[60px] p-3 border border-dashed rounded-md transition-colors",
            !readOnly && !isTempId && "cursor-pointer hover:border-primary/50 hover:bg-secondary/30",
            !readOnly && isTempId && "opacity-60 cursor-not-allowed"
          )}
          onClick={() => !readOnly && !isTempId && setIsEditing(true)}
          title={isTempId ? "Wait for task to be created before editing" : undefined}
        >
          {task.description ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: task.description }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Add a more detailed description...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
