"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setCustomFieldValue,
  type CustomField,
} from "@/lib/actions/custom-fields";
import { useCustomFields } from "@/lib/query/queries/custom-fields";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { queryKeys } from "@/lib/query/queries/tasks";
import { Settings2, Loader2 } from "lucide-react";

type FieldWithValue = CustomField & { value: string | null };

interface CustomFieldsProps {
  task: TaskWithRelations;
  boardId: string;
  onChanged: () => void;
  readOnly?: boolean;
}

export function CustomFields({
  task,
  boardId,
  onChanged,
  readOnly = false,
}: CustomFieldsProps) {
  const { data: fieldDefs = [], isLoading } = useCustomFields(boardId);
  const queryClient = useQueryClient();
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Map<string, string | null>>(new Map());

  // Merge field definitions with task values and local optimistic values
  const fields: FieldWithValue[] = useMemo(() => {
    const valueMap = new Map(
      task.custom_field_values?.map((cfv) => [cfv.field_id, cfv.value]) || []
    );
    
    return fieldDefs.map((f) => ({
      ...f,
      value: localValues.has(f.id) ? localValues.get(f.id)! : (valueMap.get(f.id) || null),
    }));
  }, [fieldDefs, task.custom_field_values, localValues]);

  const handleValueChange = async (fieldId: string, value: string | null) => {
    if (readOnly) return;
    
    setSavingFieldId(fieldId);
    
    // Optimistic update
    setLocalValues((prev) => new Map(prev).set(fieldId, value));
    onChanged();

    const result = await setCustomFieldValue(task.id, fieldId, value);
    if (!result.success) {
      // Rollback on error
      setLocalValues((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fieldId);
        return newMap;
      });
    } else {
      // Clear local value on success (will use task value from next sync)
      setLocalValues((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fieldId);
        return newMap;
      });
      // Invalidate task query to refetch and update UI immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
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
                disabled={savingFieldId === field.id || readOnly}
              />
            )}

            {field.field_type === "number" && (
              <Input
                type="number"
                value={field.value || ""}
                onChange={(e) => handleValueChange(field.id, e.target.value || null)}
                placeholder="0"
                className="h-8 text-sm"
                disabled={savingFieldId === field.id || readOnly}
              />
            )}

            {field.field_type === "dropdown" && (
              <Select
                value={field.value || ""}
                onValueChange={(v) => handleValueChange(field.id, v === "__none__" ? null : v)}
                disabled={savingFieldId === field.id || readOnly}
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
