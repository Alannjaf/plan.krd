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
  getCustomFields,
  setCustomFieldValue,
  type CustomField,
} from "@/lib/actions/custom-fields";
import { type TaskWithRelations, type CustomFieldValue } from "@/lib/actions/tasks";
import { Settings2, Loader2 } from "lucide-react";

type FieldWithValue = CustomField & { value: string | null };

interface CustomFieldsProps {
  task: TaskWithRelations;
  boardId: string;
  setTask: Dispatch<SetStateAction<TaskWithRelations | null>>;
  onChanged: () => void;
}

export function CustomFields({
  task,
  boardId,
  setTask,
  onChanged,
}: CustomFieldsProps) {
  const [fields, setFields] = useState<FieldWithValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);

  useEffect(() => {
    loadFieldDefinitions();
  }, [boardId]);

  // When task custom_field_values change, update local state
  useEffect(() => {
    if (fields.length > 0) {
      const valueMap = new Map(
        task.custom_field_values?.map((cfv) => [cfv.field_id, cfv.value]) || []
      );
      setFields((prev) =>
        prev.map((f) => ({ ...f, value: valueMap.get(f.id) || null }))
      );
    }
  }, [task.custom_field_values]);

  const loadFieldDefinitions = async () => {
    setIsLoading(true);
    const fieldDefs = await getCustomFields(boardId);
    
    // Merge with preloaded values from task
    const valueMap = new Map(
      task.custom_field_values?.map((cfv) => [cfv.field_id, cfv.value]) || []
    );
    
    const fieldsWithValues = fieldDefs.map((f) => ({
      ...f,
      value: valueMap.get(f.id) || null,
    }));
    
    setFields(fieldsWithValues);
    setIsLoading(false);
  };

  const handleValueChange = async (fieldId: string, value: string | null) => {
    setSavingFieldId(fieldId);
    const oldFields = [...fields];

    // Optimistic update local state
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, value } : f))
    );
    
    // Also update parent task state
    setTask((prev) => {
      if (!prev) return prev;
      const existingIndex = prev.custom_field_values?.findIndex(
        (cfv) => cfv.field_id === fieldId
      );
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return prev;
      
      let newValues = [...(prev.custom_field_values || [])];
      if (existingIndex !== undefined && existingIndex >= 0) {
        newValues[existingIndex] = { ...newValues[existingIndex], value };
      } else {
        newValues.push({
          id: `temp-${Date.now()}`,
          field_id: fieldId,
          value,
          custom_field: {
            id: field.id,
            name: field.name,
            field_type: field.field_type,
            options: field.options,
            required: field.required,
            position: field.position,
          },
        });
      }
      return { ...prev, custom_field_values: newValues };
    });
    onChanged();

    const result = await setCustomFieldValue(task.id, fieldId, value);
    if (!result.success) {
      // Rollback on error
      setFields(oldFields);
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
