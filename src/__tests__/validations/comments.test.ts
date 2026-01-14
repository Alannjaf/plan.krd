import { createCommentSchema, updateCommentSchema } from "@/lib/validations/comments";

describe("Comment Validation Schemas", () => {
  describe("createCommentSchema", () => {
    it("should validate valid comment creation input", () => {
      const validInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        content: "This is a comment",
      };

      const result = createCommentSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("This is a comment");
      }
    });

    it("should reject missing content", () => {
      const invalidInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = createCommentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("content");
      }
    });

    it("should reject empty content", () => {
      const invalidInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        content: "",
      };

      const result = createCommentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid UUID for taskId", () => {
      const invalidInput = {
        taskId: "not-a-uuid",
        content: "Test comment",
      };

      const result = createCommentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("taskId");
      }
    });

    it("should accept content with mentions", () => {
      const validInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        content: "Hey @john, can you review this?",
      };

      const result = createCommentSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("updateCommentSchema", () => {
    it("should validate valid comment update input", () => {
      const validInput = {
        commentId: "123e4567-e89b-12d3-a456-426614174000",
        content: "Updated comment",
      };

      const result = updateCommentSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject missing content", () => {
      const invalidInput = {
        commentId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = updateCommentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid commentId", () => {
      const invalidInput = {
        commentId: "not-a-uuid",
        content: "Updated comment",
      };

      const result = updateCommentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
