"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomField,
} from "@/lib/actions/custom-fields";
import {
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  Type,
  Hash,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomFieldsSettingsProps {
  boardId: string;
}

export function CustomFieldsSettings({ boardId }: CustomFieldsSettingsProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deletingField, setDeletingField] = useState<CustomField | null>(null);

  useEffect(() => {
    loadFields();
  }, [boardId]);

  const loadFields = async () => {
    setIsLoading(true);
    const data = await getCustomFields(boardId);
    setFields(data);
    setIsLoading(false);
  };

  const handleFieldCreated = () => {
    loadFields();
    setShowCreateDialog(false);
  };

  const handleFieldUpdated = () => {
    loadFields();
    setEditingField(null);
  };

  const handleDelete = async () => {
    if (!deletingField) return;
    await deleteCustomField(deletingField.id);
    loadFields();
    setDeletingField(null);
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <Type className="h-4 w-4" />;
      case "number":
        return <Hash className="h-4 w-4" />;
      case "dropdown":
        return <ChevronDown className="h-4 w-4" />;
      default:
        return <Type className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Custom Fields</h3>
          <p className="text-sm text-muted-foreground">
            Define custom fields for all tasks in this board
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CustomFieldForm
              boardId={boardId}
              onSuccess={handleFieldCreated}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : fields.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No custom fields defined yet.</p>
          <p className="text-sm">Add fields to collect additional task information.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-3 p-3 border rounded-lg bg-secondary/20 group"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-50 group-hover:opacity-100" />
              <div className="flex items-center gap-2 text-muted-foreground">
                {getFieldTypeIcon(field.field_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{field.name}</span>
                  {field.required && (
                    <span className="text-xs text-destructive">Required</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {field.field_type}
                  {field.field_type === "dropdown" && field.options.length > 0 && (
                    <span> · {field.options.length} options</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                onClick={() => setEditingField(field)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                onClick={() => setDeletingField(field)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent>
          {editingField && (
            <CustomFieldForm
              boardId={boardId}
              field={editingField}
              onSuccess={handleFieldUpdated}
              onCancel={() => setEditingField(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingField} onOpenChange={(open) => !open && setDeletingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingField?.name}"? This will also delete
              all values for this field across all tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CustomFieldFormProps {
  boardId: string;
  field?: CustomField;
  onSuccess: () => void;
  onCancel: () => void;
}

function CustomFieldForm({ boardId, field, onSuccess, onCancel }: CustomFieldFormProps) {
  const [name, setName] = useState(field?.name || "");
  const [fieldType, setFieldType] = useState<"text" | "number" | "dropdown">(
    field?.field_type || "text"
  );
  const [options, setOptions] = useState<string[]>(field?.options || []);
  const [newOption, setNewOption] = useState("");
  const [required, setRequired] = useState(field?.required || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption("");
    }
  };

  const handleRemoveOption = (option: string) => {
    setOptions(options.filter((o) => o !== option));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);

    if (field) {
      await updateCustomField(field.id, {
        name: name.trim(),
        options: fieldType === "dropdown" ? options : [],
        required,
      });
    } else {
      await createCustomField(boardId, {
        name: name.trim(),
        field_type: fieldType,
        options: fieldType === "dropdown" ? options : [],
        required,
      });
    }

    setIsSubmitting(false);
    onSuccess();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{field ? "Edit Custom Field" : "Create Custom Field"}</DialogTitle>
        <DialogDescription>
          {field
            ? "Update the custom field settings."
            : "Add a new custom field to collect additional task information."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Field Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Story Points, Sprint, Client"
          />
        </div>

        {!field && (
          <div className="space-y-2">
            <Label htmlFor="type">Field Type</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as typeof fieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Text
                  </div>
                </SelectItem>
                <SelectItem value="number">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Number
                  </div>
                </SelectItem>
                <SelectItem value="dropdown">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    Dropdown
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {fieldType === "dropdown" && (
          <div className="space-y-2">
            <Label>Options</Label>
            <div className="flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Add an option"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={handleAddOption}>
                Add
              </Button>
            </div>
            {options.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {options.map((option) => (
                  <span
                    key={option}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                  >
                    {option}
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(option)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="required"
            checked={required}
            onCheckedChange={(checked) => setRequired(!!checked)}
          />
          <Label htmlFor="required" className="font-normal">
            Required field
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : null}
          {field ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
