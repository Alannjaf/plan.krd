"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { updateTask, type TaskWithRelations } from "@/lib/actions/tasks";
import { AlignLeft, Check, X } from "lucide-react";

interface TaskDescriptionProps {
  task: TaskWithRelations;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
}

export function TaskDescription({
  task,
  setTask,
  onChanged,
}: TaskDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
  });

  const handleSave = async () => {
    if (!editor) return;
    setIsSaving(true);

    const html = editor.getHTML();
    const newDescription = html === "<p></p>" ? null : html;
    const oldDescription = task.description;

    // Optimistic update
    setTask((prev) => (prev ? { ...prev, description: newDescription } : prev));
    onChanged();
    setIsEditing(false);

    // Persist to database
    const result = await updateTask(task.id, { description: newDescription });

    // Rollback on error
    if (!result.success) {
      setTask((prev) => (prev ? { ...prev, description: oldDescription } : prev));
      editor.commands.setContent(oldDescription || "");
    }

    setIsSaving(false);
  };

  const handleCancel = () => {
    editor?.commands.setContent(task.description || "");
    setIsEditing(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <AlignLeft className="h-4 w-4" />
        Description
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <EditorContent editor={editor} />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Check className="h-4 w-4 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="min-h-[60px] p-3 border border-dashed rounded-md cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors"
          onClick={() => setIsEditing(true)}
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
