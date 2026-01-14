import { uploadAttachmentSchema, validateFile } from "@/lib/validations/attachments";

describe("Attachment Validation Schemas", () => {
  describe("uploadAttachmentSchema", () => {
    it("should validate valid attachment creation input", () => {
      // Create a mock File object
      const mockFile = new File(["content"], "document.pdf", { type: "application/pdf" });
      const validInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        file: mockFile,
      };

      const result = uploadAttachmentSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taskId).toBe("123e4567-e89b-12d3-a456-426614174000");
        expect(result.data.file.name).toBe("document.pdf");
      }
    });

    it("should reject missing file", () => {
      const invalidInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = uploadAttachmentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("file");
      }
    });

    it("should reject invalid UUID for taskId", () => {
      const mockFile = new File(["content"], "document.pdf", { type: "application/pdf" });
      const invalidInput = {
        taskId: "not-a-uuid",
        file: mockFile,
      };

      const result = uploadAttachmentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject file that is too large", () => {
      // Create a file larger than 50MB
      const largeContent = "x".repeat(51 * 1024 * 1024);
      const mockFile = new File([largeContent], "large.pdf", { type: "application/pdf" });
      const invalidInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        file: mockFile,
      };

      const result = uploadAttachmentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid file type", () => {
      const mockFile = new File(["content"], "document.exe", { type: "application/x-msdownload" });
      const invalidInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        file: mockFile,
      };

      const result = uploadAttachmentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("validateFile", () => {
    it("should validate valid file", () => {
      const mockFile = new File(["content"], "document.pdf", { type: "application/pdf" });
      const result = validateFile(mockFile);
      expect(result.valid).toBe(true);
    });

    it("should reject file that is too large", () => {
      const largeContent = "x".repeat(51 * 1024 * 1024);
      const mockFile = new File([largeContent], "large.pdf", { type: "application/pdf" });
      const result = validateFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject invalid file type", () => {
      const mockFile = new File(["content"], "document.exe", { type: "application/x-msdownload" });
      const result = validateFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
