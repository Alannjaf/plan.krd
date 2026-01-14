import { vi } from "vitest";
import { getComments, createComment, updateComment, deleteComment } from "@/lib/actions/comments";

// Mock dependencies
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/actions/activities");
vi.mock("@/lib/actions/notifications");
vi.mock("@/lib/utils/mentions");

describe("Comment Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getComments", () => {
    it("should return empty array for temp task IDs", async () => {
      const result = await getComments("temp-123");
      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      mockClient.mockResolvedValueOnce({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(() => ({
            data: null,
            error: { message: "Database error" },
          })),
        })),
      });

      const result = await getComments("task-1");
      expect(result).toEqual([]);
    });

    it("should build threaded comment structure", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      const mockData = [
        { id: "1", task_id: "task-1", parent_id: null, content: "Root comment" },
        { id: "2", task_id: "task-1", parent_id: "1", content: "Reply comment" },
      ];

      mockClient.mockResolvedValueOnce({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(() => ({
            data: mockData,
            error: null,
          })),
        })),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const result = await getComments("task-1");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("createComment", () => {
    it("should return error when user is not authenticated", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      mockClient.mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const result = await createComment("task-1", "Comment content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("authenticated");
    });
  });

  describe("updateComment", () => {
    it("should update comment successfully", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      let callCount = 0;
      mockClient.mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
          }),
        },
        from: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            // First call: select to get user_id and task_id
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { user_id: "user-1", task_id: "task-1" },
                error: null,
              }),
            };
          } else {
            // Second call: update
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            };
          }
        }),
      });

      // Mock logActivity
      const { logActivity } = await import("@/lib/actions/activities");
      vi.mocked(logActivity).mockResolvedValue({ success: true });

      // Use valid UUID format for commentId
      const result = await updateComment("123e4567-e89b-12d3-a456-426614174000", "Updated content");
      expect(result.success).toBe(true);
    });

    it("should return error on database error", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      let callCount = 0;
      mockClient.mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
          }),
        },
        from: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            // First call: select to get user_id and task_id
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { user_id: "user-1", task_id: "task-1" },
                error: null,
              }),
            };
          } else {
            // Second call: update (with error)
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn(() => ({
                data: null,
                error: { message: "Database error" },
              })),
            };
          }
        }),
      });

      // Use valid UUID format for commentId
      const result = await updateComment("123e4567-e89b-12d3-a456-426614174000", "Updated content");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("deleteComment", () => {
    it("should delete comment successfully", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      let callCount = 0;
      mockClient.mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
          }),
        },
        from: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            // First call: select to get user_id and task_id
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { user_id: "user-1", task_id: "task-1" },
                error: null,
              }),
            };
          } else {
            // Second call: delete
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            };
          }
        }),
      });

      // Use valid UUID format for commentId
      const result = await deleteComment("123e4567-e89b-12d3-a456-426614174000");
      expect(result.success).toBe(true);
    });

    it("should return error on database error", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      let callCount = 0;
      mockClient.mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
          }),
        },
        from: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            // First call: select to get user_id and task_id
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { user_id: "user-1", task_id: "task-1" },
                error: null,
              }),
            };
          } else {
            // Second call: delete (with error)
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn(() => ({
                data: null,
                error: { message: "Database error" },
              })),
            };
          }
        }),
      });

      // Use valid UUID format for commentId
      const result = await deleteComment("123e4567-e89b-12d3-a456-426614174000");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
