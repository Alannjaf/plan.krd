"use server";

import { createClient } from "@/lib/supabase/server";

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
    console.error("Error fetching attachments:", error);
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
    console.error("Error uploading file:", uploadError);
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
    console.error("Error creating attachment record:", error);
    // Try to clean up the uploaded file
    await supabase.storage.from("attachments").remove([fileName]);
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
    console.error("Error fetching attachment:", fetchError);
    return { success: false, error: fetchError.message };
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("attachments")
    .remove([attachment.file_path]);

  if (storageError) {
    console.error("Error deleting file from storage:", storageError);
    // Continue to delete the record anyway
  }

  // Delete the record
  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    console.error("Error deleting attachment record:", error);
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
    console.error("Error getting signed URL:", error);
    return { url: null, error: error.message };
  }

  return { url: data.signedUrl };
}

export function isImageFile(fileType: string): boolean {
  return fileType.startsWith("image/");
}

export function isPdfFile(fileType: string): boolean {
  return fileType === "application/pdf";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
