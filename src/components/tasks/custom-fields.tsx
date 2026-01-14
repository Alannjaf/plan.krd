"use client";

import { useState, useMemo, useEffect } from "react";
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

  // Sync local values with task prop - clear local values when task prop updates with matching values
  // This ensures optimistic updates are cleared once the real data arrives
  useEffect(() => {
    setLocalValues((prev) => {
      if (prev.size === 0) return prev;
      
      const newMap = new Map(prev);
      // Remove local values that now exist in task prop with matching values
      // This means the optimistic update has been confirmed by the server
      task.custom_field_values?.forEach((cfv) => {
        const localValue = newMap.get(cfv.field_id);
        if (localValue !== undefined && localValue === cfv.value) {
          newMap.delete(cfv.field_id);
        }
      });
      // Also remove local values for fields that were deleted (value is null)
      if (task.custom_field_values) {
        const taskFieldIds = new Set(task.custom_field_values.map(cfv => cfv.field_id));
        newMap.forEach((localValue, fieldId) => {
          if (!taskFieldIds.has(fieldId) && localValue === null) {
            newMap.delete(fieldId);
          }
        });
      }
      return newMap;
    });
  }, [task.custom_field_values]);

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
    
    // Optimistic update to local state (for immediate UI feedback)
    setLocalValues((prev) => new Map(prev).set(fieldId, value));
    onChanged();

    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: queryKeys.task(task.id) });

    // Snapshot previous state for rollback
    const previousTask = queryClient.getQueryData<TaskWithRelations>(
      queryKeys.task(task.id)
    );

    // Get custom field info
    const field = fieldDefs.find((f) => f.id === fieldId);
    if (!field) {
      setSavingFieldId(null);
      return;
    }

    // Optimistically update query cache
    queryClient.setQueryData<TaskWithRelations>(
      queryKeys.task(task.id),
      (old) => {
        if (!old) return old;

        // Update or add custom field value
        const existingValueIndex = old.custom_field_values?.findIndex(
          (cfv) => cfv.field_id === fieldId
        );

        const optimisticValue = {
          id: `temp-${Date.now()}`,
          field_id: fieldId,
          value,
          custom_field: {
            id: field.id,
            name: field.name,
            field_type: field.field_type as "text" | "number" | "dropdown",
            options: field.options || [],
            required: field.required,
            position: field.position,
          },
        };

        let newCustomFieldValues: typeof old.custom_field_values;
        if (existingValueIndex !== undefined && existingValueIndex >= 0) {
          // Update existing
          newCustomFieldValues = [...(old.custom_field_values || [])];
          newCustomFieldValues[existingValueIndex] = optimisticValue;
        } else {
          // Add new
          newCustomFieldValues = [
            ...(old.custom_field_values || []),
            optimisticValue,
          ];
        }

        return {
          ...old,
          custom_field_values: newCustomFieldValues,
        };
      }
    );

    try {
      const result = await setCustomFieldValue(task.id, fieldId, value);
      if (!result.success) {
        throw new Error(result.error || "Failed to set custom field");
      }
      // Refetch to get real data (this will update the task prop)
      // The useEffect will clear the local value when task prop updates
      queryClient.invalidateQueries({ queryKey: queryKeys.task(task.id) });
    } catch (error) {
      // Rollback on error
      if (previousTask) {
        queryClient.setQueryData(queryKeys.task(task.id), previousTask);
      }
      setLocalValues((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fieldId);
        return newMap;
      });
      console.error("Failed to set custom field:", error);
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
