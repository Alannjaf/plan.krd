import { isImageFile, isPdfFile, formatFileSize } from "@/lib/utils/file-helpers";

describe("File Helpers", () => {
  describe("isImageFile", () => {
    it("should return true for image/jpeg", () => {
      expect(isImageFile("image/jpeg")).toBe(true);
    });

    it("should return true for image/png", () => {
      expect(isImageFile("image/png")).toBe(true);
    });

    it("should return true for image/gif", () => {
      expect(isImageFile("image/gif")).toBe(true);
    });

    it("should return true for image/webp", () => {
      expect(isImageFile("image/webp")).toBe(true);
    });

    it("should return false for application/pdf", () => {
      expect(isImageFile("application/pdf")).toBe(false);
    });

    it("should return false for text/plain", () => {
      expect(isImageFile("text/plain")).toBe(false);
    });
  });

  describe("isPdfFile", () => {
    it("should return true for application/pdf", () => {
      expect(isPdfFile("application/pdf")).toBe(true);
    });

    it("should return false for image/jpeg", () => {
      expect(isPdfFile("image/jpeg")).toBe(false);
    });

    it("should return false for text/plain", () => {
      expect(isPdfFile("text/plain")).toBe(false);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
      expect(formatFileSize(500)).toBe("500 Bytes");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(2048)).toBe("2 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
      expect(formatFileSize(2097152)).toBe("2 MB");
      expect(formatFileSize(1572864)).toBe("1.5 MB");
    });

    it("should format gigabytes", () => {
      expect(formatFileSize(1073741824)).toBe("1 GB");
      expect(formatFileSize(2147483648)).toBe("2 GB");
    });

    it("should handle large numbers", () => {
      const result = formatFileSize(10737418240); // 10 GB
      expect(result).toContain("GB");
    });

    it("should round to 2 decimal places", () => {
      const result = formatFileSize(1536); // 1.5 KB
      expect(result).toBe("1.5 KB");
    });
  });
});
