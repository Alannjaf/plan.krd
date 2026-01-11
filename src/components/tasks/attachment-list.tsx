"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentUrl,
  type Attachment,
} from "@/lib/actions/attachments";
import { isImageFile, isPdfFile, formatFileSize } from "@/lib/utils/file-helpers";
import { logActivity } from "@/lib/actions/activities";
import {
  Paperclip,
  Upload,
  X,
  File,
  Image as ImageIcon,
  FileText,
  Loader2,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentListProps {
  taskId: string;
  onUpdate: () => void;
}

export function AttachmentList({ taskId, onUpdate }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    loadAttachments();
  }, [taskId]);

  const loadAttachments = async () => {
    setIsLoading(true);
    const data = await getAttachments(taskId);
    setAttachments(data);
    setIsLoading(false);
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsUploading(true);
      setUploadProgress(0);

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const result = await uploadAttachment(taskId, file);
        if (result.success) {
          await logActivity(taskId, "attachment_added", { fileName: file.name });
        }
        setUploadProgress(((i + 1) / acceptedFiles.length) * 100);
      }

      loadAttachments();
      onUpdate();
      setIsUploading(false);
    },
    [taskId, onUpdate]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleDelete = async (attachment: Attachment) => {
    const result = await deleteAttachment(attachment.id);
    if (result.success) {
      await logActivity(taskId, "attachment_deleted", {
        fileName: attachment.file_name,
      });
      loadAttachments();
      onUpdate();
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    const { url } = await getAttachmentUrl(attachment.file_path);
    if (url) {
      window.open(url, "_blank");
    }
  };

  const getFileIcon = (fileType: string) => {
    if (isImageFile(fileType)) return <ImageIcon className="h-8 w-8" />;
    if (isPdfFile(fileType)) return <FileText className="h-8 w-8" />;
    return <File className="h-8 w-8" />;
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
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
        )}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Uploading... {Math.round(uploadProgress)}%
            </p>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AttachmentCardProps {
  attachment: Attachment;
  onDelete: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
}

function AttachmentCard({ attachment, onDelete, onDownload }: AttachmentCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (isImageFile(attachment.file_type)) {
      loadPreview();
    }
  }, [attachment]);

  const loadPreview = async () => {
    setIsLoadingPreview(true);
    const { url } = await getAttachmentUrl(attachment.file_path);
    setPreviewUrl(url);
    setIsLoadingPreview(false);
  };

  return (
    <div className="group relative border rounded-lg p-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-secondary/50 rounded-md overflow-hidden">
          {isImageFile(attachment.file_type) ? (
            isLoadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={attachment.file_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )
          ) : isPdfFile(attachment.file_type) ? (
            <FileText className="h-6 w-6 text-muted-foreground" />
          ) : (
            <File className="h-6 w-6 text-muted-foreground" />
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
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6"
          onClick={() => onDownload(attachment)}
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => onDelete(attachment)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
