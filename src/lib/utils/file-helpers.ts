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
