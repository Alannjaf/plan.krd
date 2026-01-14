import { createBoardSchema, updateBoardSchema } from "@/lib/validations/boards";

describe("Board Validation Schemas", () => {
  describe("createBoardSchema", () => {
    it("should validate valid board creation input", () => {
      const validInput = {
        workspaceId: "123e4567-e89b-12d3-a456-426614174000",
        name: "My Board",
        description: "Board description",
      };

      const result = createBoardSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("My Board");
        expect(result.data.description).toBe("Board description");
      }
    });

    it("should validate with minimal required fields", () => {
      const minimalInput = {
        workspaceId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Minimal Board",
      };

      const result = createBoardSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
    });

    it("should reject missing name", () => {
      const invalidInput = {
        workspaceId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = createBoardSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("name");
      }
    });

    it("should reject invalid UUID for workspaceId", () => {
      const invalidInput = {
        workspaceId: "not-a-uuid",
        name: "Test Board",
      };

      const result = createBoardSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("workspaceId");
      }
    });

    it("should reject name that is too long", () => {
      const invalidInput = {
        workspaceId: "123e4567-e89b-12d3-a456-426614174000",
        name: "a".repeat(201), // Exceeds 200 character limit
      };

      const result = createBoardSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("name");
      }
    });

    it("should reject description that is too long", () => {
      const invalidInput = {
        workspaceId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Board",
        description: "a".repeat(1001), // Exceeds 1000 character limit
      };

      const result = createBoardSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("description");
      }
    });
  });

  describe("updateBoardSchema", () => {
    it("should validate valid board update input", () => {
      const validInput = {
        boardId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Updated Board",
        description: "Updated description",
      };

      const result = updateBoardSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should allow partial updates", () => {
      const partialInput = {
        boardId: "123e4567-e89b-12d3-a456-426614174000",
        name: "New Name",
      };

      const result = updateBoardSchema.safeParse(partialInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid boardId", () => {
      const invalidInput = {
        boardId: "not-a-uuid",
        name: "Updated Name",
      };

      const result = updateBoardSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should allow undefined description", () => {
      const inputWithoutDescription = {
        boardId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = updateBoardSchema.safeParse(inputWithoutDescription);
      expect(result.success).toBe(true);
    });
  });
});
