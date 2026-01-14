"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

export type Attachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function getAttachments(taskId: string): Promise<Attachment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching attachments", error, { taskId });
    return [];
  }

  return data || [];
}

export async function uploadAttachment(
  taskId: string,
  file: File
): Promise<{ success: boolean; attachment?: Attachment; error?: string }> {
  const supabase = await createClient();

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File size exceeds 50MB limit" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  // Generate unique file path
  const fileExt = file.name.split(".").pop();
  const fileName = `${taskId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(fileName, file);

  if (uploadError) {
    logger.error("Error uploading file", uploadError, { taskId, fileName, fileSize: file.size, userId: user.id });
    return { success: false, error: uploadError.message };
  }

  // Create attachment record
  const { data, error } = await supabase
    .from("attachments")
    .insert({
      task_id: taskId,
      file_name: file.name,
      file_path: fileName,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating attachment record", error, { taskId, fileName, userId: user.id });
    // Try to clean up the uploaded file
    await supabase.storage.from("attachments").remove([fileName]);
    return { success: false, error: error.message };
  }

  return { success: true, attachment: data };
}

// Create attachment record only (used when upload is done client-side for progress tracking)
export async function createAttachmentRecord(
  taskId: string,
  fileInfo: {
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }
): Promise<{ success: boolean; attachment?: Attachment; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      task_id: taskId,
      file_name: fileInfo.file_name,
      file_path: fileInfo.file_path,
      file_type: fileInfo.file_type,
      file_size: fileInfo.file_size,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating attachment record", error, { taskId, fileName: fileInfo.file_name, userId: user.id });
    return { success: false, error: error.message };
  }

  return { success: true, attachment: data };
}

export async function deleteAttachment(
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get the attachment to find the file path
  const { data: attachment, error: fetchError } = await supabase
    .from("attachments")
    .select("file_path")
    .eq("id", attachmentId)
    .single();

  if (fetchError) {
    logger.error("Error fetching attachment", fetchError, { attachmentId });
    return { success: false, error: fetchError.message };
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("attachments")
    .remove([attachment.file_path]);

  if (storageError) {
    logger.error("Error deleting file from storage", storageError, { attachmentId, filePath: attachment.file_path });
    // Continue to delete the record anyway
  }

  // Delete the record
  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    logger.error("Error deleting attachment record", error, { attachmentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getAttachmentUrl(
  filePath: string
): Promise<{ url: string | null; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    logger.error("Error getting signed URL", error, { filePath });
    return { url: null, error: error.message };
  }

  return { url: data.signedUrl };
}
