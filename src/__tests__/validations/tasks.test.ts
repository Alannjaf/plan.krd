import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "@/lib/validations/tasks";

describe("Task Validation Schemas", () => {
  describe("createTaskSchema", () => {
    it("should validate valid task creation input", () => {
      const validInput = {
        listId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Test Task",
        description: "Test description",
        priority: "high" as const,
        due_date: "2024-12-31",
      };

      const result = createTaskSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Test Task");
        expect(result.data.priority).toBe("high");
      }
    });

    it("should validate with minimal required fields", () => {
      const minimalInput = {
        listId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Minimal Task",
      };

      const result = createTaskSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
    });

    it("should reject missing title", () => {
      const invalidInput = {
        listId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = createTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("title");
      }
    });

    it("should reject invalid UUID for listId", () => {
      const invalidInput = {
        listId: "not-a-uuid",
        title: "Test Task",
      };

      const result = createTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("listId");
      }
    });

    it("should reject invalid priority", () => {
      const invalidInput = {
        listId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Test Task",
        priority: "invalid" as any,
      };

      const result = createTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const invalidInput = {
        listId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Test Task",
        due_date: "31-12-2024", // Wrong format
      };

      const result = createTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("due_date");
      }
    });

    it("should reject title that is too long", () => {
      const invalidInput = {
        listId: "123e4567-e89b-12d3-a456-426614174000",
        title: "a".repeat(501), // Exceeds 500 character limit
      };

      const result = createTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("title");
      }
    });
  });

  describe("updateTaskSchema", () => {
    it("should validate valid task update input", () => {
      const validInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Updated Title",
        priority: "low" as const,
      };

      const result = updateTaskSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should allow partial updates", () => {
      const partialInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        title: "New Title",
      };

      const result = updateTaskSchema.safeParse(partialInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid taskId", () => {
      const invalidInput = {
        taskId: "not-a-uuid",
        title: "Updated Title",
      };

      const result = updateTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should allow null values for optional fields", () => {
      const inputWithNulls = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        priority: null,
        due_date: null,
      };

      const result = updateTaskSchema.safeParse(inputWithNulls);
      expect(result.success).toBe(true);
    });
  });

  describe("moveTaskSchema", () => {
    it("should validate valid task movement input", () => {
      const validInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        targetListId: "123e4567-e89b-12d3-a456-426614174001",
        newPosition: 5,
      };

      const result = moveTaskSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject negative position", () => {
      const invalidInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        targetListId: "123e4567-e89b-12d3-a456-426614174001",
        newPosition: -1,
      };

      const result = moveTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject non-integer position", () => {
      const invalidInput = {
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        targetListId: "123e4567-e89b-12d3-a456-426614174001",
        newPosition: 5.5,
      };

      const result = moveTaskSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
