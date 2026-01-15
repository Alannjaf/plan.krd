"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  createAttachmentRecord,
  deleteAttachment,
  getAttachmentUrl,
  type Attachment,
} from "@/lib/actions/attachments";
import { useAttachments } from "@/lib/query/queries/attachments";
import { queryKeys as attachmentQueryKeys } from "@/lib/query/queries/attachments";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { type TaskWithRelations } from "@/lib/actions/tasks";
import { isImageFile, isPdfFile, formatFileSize } from "@/lib/utils/file-helpers";
import { logActivity } from "@/lib/actions/activities";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  File,
  Image as ImageIcon,
  FileText,
  Loader2,
  Download,
  Trash2,
  X,
  Eye,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentChat } from "@/components/ai/document-chat";

interface AttachmentListProps {
  task: TaskWithRelations;
  onChanged: () => void;
}

export function AttachmentList({ task, onChanged }: AttachmentListProps) {
  const queryClient = useQueryClient();
  const { data: attachments = [], isLoading } = useAttachments(task.id);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [chatAttachment, setChatAttachment] = useState<Attachment | null>(null);

  // Client-side upload with progress simulation
  const uploadFileWithProgress = async (
    file: File,
    onProgress: (progress: number) => void
  ): Promise<{ success: boolean; attachment?: Attachment }> => {
    const supabase = createClient();
    
    // Generate unique file path
    const fileExt = file.name.split(".").pop();
    const fileName = `${task.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Start progress simulation based on file size
    const fileSizeMB = file.size / (1024 * 1024);
    const estimatedTimeMs = Math.max(500, fileSizeMB * 200); // ~200ms per MB, min 500ms
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(90, (elapsed / estimatedTimeMs) * 90);
      onProgress(progress);
    }, 50);

    try {
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        onProgress(0);
        return { success: false };
      }

      onProgress(95);

      // Create database record
      const result = await createAttachmentRecord(task.id, {
        file_name: file.name,
        file_path: fileName,
        file_type: file.type,
        file_size: file.size,
      });

      if (result.success) {
        await logActivity(task.id, "attachment_added", { fileName: file.name });
      }

      onProgress(100);
      return result;
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Upload error:", error);
      return { success: false };
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsUploading(true);
      
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        setCurrentFileName(file.name);
        setUploadProgress(0);
        
        const result = await uploadFileWithProgress(file, setUploadProgress);
        
        if (result.success && result.attachment) {
          // Invalidate attachments query to refetch
          queryClient.invalidateQueries({ queryKey: attachmentQueryKeys.attachments(task.id) });
          onChanged();
        }
        
        // Brief pause between files for visual feedback
        if (i < acceptedFiles.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      setIsUploading(false);
      setUploadProgress(0);
      setCurrentFileName("");
    },
    [task.id, onChanged, queryClient]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleDelete = async (attachment: Attachment) => {
    const result = await deleteAttachment(attachment.id);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: attachmentQueryKeys.attachments(task.id) });
      onChanged();
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    const { url } = await getAttachmentUrl(attachment.file_path);
    if (url) {
      // Force download
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    setPreviewAttachment(attachment);
    const { url } = await getAttachmentUrl(attachment.file_path);
    setPreviewUrl(url);
  };

  const closePreview = () => {
    setPreviewAttachment(null);
    setPreviewUrl(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/30",
          isUploading && "pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="w-full max-w-xs space-y-2">
              <p className="text-sm font-medium truncate">{currentFileName}</p>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {Math.round(uploadProgress)}% uploaded
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive
                ? "Drop files here..."
                : "Drag & drop files here, or click to select"}
            </p>
            <p className="text-xs text-muted-foreground">Max file size: 50MB</p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>{previewAttachment?.file_name || "Preview"}</DialogTitle>
          </VisuallyHidden>
          {previewAttachment && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-secondary/30">
                <div className="flex items-center gap-3 min-w-0">
                  {isImageFile(previewAttachment.file_type) ? (
                    <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : isPdfFile(previewAttachment.file_type) ? (
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <File className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{previewAttachment.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(previewAttachment.file_size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => previewUrl && window.open(previewUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewAttachment)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button variant="ghost" size="icon" onClick={closePreview}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 flex items-center justify-center p-4 bg-black/90 min-h-[400px] max-h-[70vh] overflow-auto">
                {!previewUrl ? (
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                ) : isImageFile(previewAttachment.file_type) ? (
                  <img
                    src={previewUrl}
                    alt={previewAttachment.file_name}
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                  />
                ) : isPdfFile(previewAttachment.file_type) ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full min-h-[500px] bg-white rounded"
                    title={previewAttachment.file_name}
                  />
                ) : (
                  <div className="text-center text-white">
                    <File className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">{previewAttachment.file_name}</p>
                    <p className="text-sm text-white/60 mt-1">
                      Preview not available for this file type
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-4"
                      onClick={() => handleDownload(previewAttachment)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download to view
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attachments Grid */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attachments yet
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {attachments.map((attachment) => (
            <AttachmentCard
              key={attachment.id}
              attachment={attachment}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onChat={isPdfFile(attachment.file_type) ? setChatAttachment : undefined}
            />
          ))}
        </div>
      )}

      {/* Document Chat Dialog */}
      {chatAttachment && (
        <DocumentChat
          attachment={chatAttachment}
          open={!!chatAttachment}
          onOpenChange={(open) => !open && setChatAttachment(null)}
        />
      )}
    </div>
  );
}

interface AttachmentCardProps {
  attachment: Attachment;
  onDelete: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
  onPreview: (attachment: Attachment) => void;
  onChat?: (attachment: Attachment) => void;
}

function AttachmentCard({ attachment, onDelete, onDownload, onPreview, onChat }: AttachmentCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading thumbnails
  useEffect(() => {
    if (!cardRef.current || !isImageFile(attachment.file_type)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [attachment.file_type]);

  // Load thumbnail only when visible
  useEffect(() => {
    if (isVisible && isImageFile(attachment.file_type) && !thumbnailUrl) {
      loadThumbnail();
    }
  }, [isVisible, attachment.file_type, thumbnailUrl]);

  const loadThumbnail = async () => {
    setIsLoadingThumbnail(true);
    const { url } = await getAttachmentUrl(attachment.file_path);
    setThumbnailUrl(url);
    setIsLoadingThumbnail(false);
  };

  const canPreview = isImageFile(attachment.file_type) || isPdfFile(attachment.file_type);

  return (
    <div 
      ref={cardRef}
      className="group relative border rounded-lg p-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      onClick={() => onPreview(attachment)}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-secondary/50 rounded-md overflow-hidden relative">
          {isImageFile(attachment.file_type) ? (
            isLoadingThumbnail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={attachment.file_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )
          ) : isPdfFile(attachment.file_type) ? (
            <FileText className="h-6 w-6 text-muted-foreground" />
          ) : (
            <File className="h-6 w-6 text-muted-foreground" />
          )}
          {/* Preview overlay on hover */}
          {canPreview && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.file_size)}
          </p>
        </div>
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onChat && (
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onChat(attachment);
            }}
            title="Chat with document"
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(attachment);
          }}
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(attachment);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
