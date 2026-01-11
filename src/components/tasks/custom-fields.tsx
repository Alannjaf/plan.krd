"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCustomFieldsWithValues,
  setCustomFieldValue,
  type CustomFieldWithValue,
} from "@/lib/actions/custom-fields";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { Settings2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomFieldsProps {
  taskId: string;
  boardId: string;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
}

export function CustomFields({
  taskId,
  boardId,
  setTask,
  onChanged,
}: CustomFieldsProps) {
  const [fields, setFields] = useState<CustomFieldWithValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);

  useEffect(() => {
    loadFields();
  }, [taskId, boardId]);

  const loadFields = async () => {
    setIsLoading(true);
    const data = await getCustomFieldsWithValues(boardId, taskId);
    setFields(data);
    setIsLoading(false);
  };

  const handleValueChange = async (fieldId: string, value: string | null) => {
    setSavingFieldId(fieldId);

    // Optimistic update
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, value } : f))
    );
    onChanged();

    const result = await setCustomFieldValue(taskId, fieldId, value);
    if (!result.success) {
      // Rollback on error
      loadFields();
    }

    setSavingFieldId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading fields...</span>
      </div>
    );
  }

  if (fields.length === 0) {
    return null; // Don't show section if no custom fields defined
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Settings2 className="h-4 w-4" />
        Custom Fields
      </div>

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.id} className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              {field.name}
              {field.required && <span className="text-destructive">*</span>}
            </label>

            {field.field_type === "text" && (
              <Input
                value={field.value || ""}
                onChange={(e) => handleValueChange(field.id, e.target.value || null)}
                placeholder={`Enter ${field.name.toLowerCase()}`}
                className="h-8 text-sm"
                disabled={savingFieldId === field.id}
              />
            )}

            {field.field_type === "number" && (
              <Input
                type="number"
                value={field.value || ""}
                onChange={(e) => handleValueChange(field.id, e.target.value || null)}
                placeholder="0"
                className="h-8 text-sm"
                disabled={savingFieldId === field.id}
              />
            )}

            {field.field_type === "dropdown" && (
              <Select
                value={field.value || ""}
                onValueChange={(v) => handleValueChange(field.id, v === "__none__" ? null : v)}
                disabled={savingFieldId === field.id}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {field.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
