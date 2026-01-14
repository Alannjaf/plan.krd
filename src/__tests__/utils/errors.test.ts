import { describe, it, expect, vi } from "vitest";
import { getErrorMessage, success, failure } from "@/lib/utils/errors";

describe("Error utilities", () => {
  describe("getErrorMessage", () => {
    it("should extract message from Error object", () => {
      const error = new Error("Test error");
      expect(getErrorMessage(error)).toBe("Test error");
    });

    it("should return string as-is", () => {
      expect(getErrorMessage("String error")).toBe("String error");
    });

    it("should extract message from error-like object", () => {
      const error = { message: "Object error" };
      expect(getErrorMessage(error)).toBe("Object error");
    });

    it("should return default message for unknown error", () => {
      expect(getErrorMessage(null)).toBe("An unexpected error occurred");
      expect(getErrorMessage(undefined)).toBe("An unexpected error occurred");
      expect(getErrorMessage({})).toBe("An unexpected error occurred");
    });
  });

  describe("Result helpers", () => {
    it("should create success result", () => {
      const result = success({ id: "123" });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: "123" });
      expect(result.error).toBeUndefined();
    });

    it("should create failure result", () => {
      const result = failure("Error message");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Error message");
      expect(result.data).toBeUndefined();
    });
  });
});
