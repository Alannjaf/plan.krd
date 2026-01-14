"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

export type CustomField = {
  id: string;
  board_id: string;
  name: string;
  field_type: "text" | "number" | "dropdown";
  options: string[];
  position: number;
  required: boolean;
  created_at: string;
};

export type CustomFieldValue = {
  id: string;
  task_id: string;
  field_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomFieldWithValue = CustomField & {
  value: string | null;
};

// Get all custom fields for a board
export async function getCustomFields(boardId: string): Promise<CustomField[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  if (error) {
    logger.error("Error fetching custom fields", error, { boardId });
    return [];
  }

  return data || [];
}

// Get custom field values for a task
export async function getCustomFieldValues(
  taskId: string
): Promise<CustomFieldValue[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("custom_field_values")
    .select("*")
    .eq("task_id", taskId);

  if (error) {
    logger.error("Error fetching custom field values", error, { taskId });
    return [];
  }

  return data || [];
}

// Get custom fields with their values for a task
export async function getCustomFieldsWithValues(
  boardId: string,
  taskId: string
): Promise<CustomFieldWithValue[]> {
  const [fields, values] = await Promise.all([
    getCustomFields(boardId),
    getCustomFieldValues(taskId),
  ]);

  const valueMap = new Map(values.map((v) => [v.field_id, v.value]));

  return fields.map((field) => ({
    ...field,
    value: valueMap.get(field.id) || null,
  }));
}

// Create a new custom field
export async function createCustomField(
  boardId: string,
  data: {
    name: string;
    field_type: "text" | "number" | "dropdown";
    options?: string[];
    required?: boolean;
  }
): Promise<{ success: boolean; field?: CustomField; error?: string }> {
  const supabase = await createClient();

  // Get max position
  const { data: existing } = await supabase
    .from("custom_fields")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1);

  const position = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const { data: field, error } = await supabase
    .from("custom_fields")
    .insert({
      board_id: boardId,
      name: data.name,
      field_type: data.field_type,
      options: data.options || [],
      required: data.required || false,
      position,
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating custom field", error, { boardId, fieldType: data.field_type, name: data.name });
    return { success: false, error: error.message };
  }

  return { success: true, field };
}

// Update a custom field
export async function updateCustomField(
  fieldId: string,
  updates: {
    name?: string;
    options?: string[];
    required?: boolean;
    position?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("custom_fields")
    .update(updates)
    .eq("id", fieldId);

  if (error) {
    logger.error("Error updating custom field", error, { fieldId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Delete a custom field
export async function deleteCustomField(
  fieldId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("custom_fields")
    .delete()
    .eq("id", fieldId);

  if (error) {
    console.error("Error deleting custom field:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Set a custom field value for a task (upsert)
export async function setCustomFieldValue(
  taskId: string,
  fieldId: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  if (value === null || value === "") {
    // Delete the value if null or empty
    const { error } = await supabase
      .from("custom_field_values")
      .delete()
      .eq("task_id", taskId)
      .eq("field_id", fieldId);

    if (error) {
      logger.error("Error deleting custom field value", error, { taskId, fieldId });
      return { success: false, error: error.message };
    }
  } else {
    // Upsert the value
    const { error } = await supabase
      .from("custom_field_values")
      .upsert(
        {
          task_id: taskId,
          field_id: fieldId,
          value,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "task_id,field_id",
        }
      );

    if (error) {
      console.error("Error setting custom field value:", error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

// Reorder custom fields
export async function reorderCustomFields(
  boardId: string,
  fieldIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const updates = fieldIds.map((id, index) =>
    supabase.from("custom_fields").update({ position: index }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const error = results.find((r) => r.error);

  if (error?.error) {
    logger.error("Error reordering custom fields", error.error, { boardId, fieldIdsCount: fieldIds.length });
    return { success: false, error: error.error.message };
  }

  return { success: true };
}
