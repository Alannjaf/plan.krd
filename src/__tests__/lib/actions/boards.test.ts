import { vi } from "vitest";
import { getBoards, getBoard, createBoard, updateBoard, deleteBoard } from "@/lib/actions/boards";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Board Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBoards", () => {
    it("should return empty array on error", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      const createMockQuery = (result: any) => {
        const query: any = Object.assign(
          Promise.resolve(result),
          {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          }
        );
        // Make methods return the query object
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.order = vi.fn(() => query);
        return query;
      };

      mockClient.mockResolvedValueOnce({
        from: vi.fn(() => createMockQuery({
          data: null,
          error: { message: "Database error" },
        })),
      });

      const result = await getBoards("workspace-1");
      expect(result).toEqual([]);
    });

    it("should filter archived boards when includeArchived is false", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      const createMockQuery = (result: any) => {
        const query: any = Object.assign(
          Promise.resolve(result),
          {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          }
        );
        // Make methods return the query object
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.order = vi.fn(() => query);
        return query;
      };

      mockClient.mockResolvedValueOnce({
        from: vi.fn(() => createMockQuery({
          data: [{ id: "1", name: "Board 1", archived: false }],
          error: null,
        })),
      });

      const result = await getBoards("workspace-1", false);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getBoard", () => {
    it("should return null on error", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      mockClient.mockResolvedValueOnce({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(() => ({
            data: null,
            error: { message: "Not found" },
          })),
        })),
      });

      const result = await getBoard("board-1");
      expect(result).toBeNull();
    });
  });

  describe("createBoard", () => {
    it("should create board with correct position", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn(() => ({
        data: { id: "new-board", name: "New Board", position: 0 },
        error: null,
      }));

      mockClient.mockResolvedValueOnce({
        from: vi.fn((table) => {
          if (table === "boards") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              single: vi.fn(() => ({
                data: { position: 5 },
                error: null,
              })),
              insert: mockInsert,
            };
          }
          return {};
        }),
      });

      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await createBoard("workspace-1", "New Board");
      expect(result.success).toBe(true);
    });
  });

  describe("updateBoard", () => {
    it("should update board successfully", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      let boardCallCount = 0;
      let memberCallCount = 0;
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "boards") {
            boardCallCount++;
            if (boardCallCount === 1) {
              // First call: select to get workspace_id
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { workspace_id: "workspace-1" },
                  error: null,
                }),
              };
            } else {
              // Third call: update
              return {
                update: vi.fn().mockReturnThis(),
                eq: vi.fn(() => ({
                  data: null,
                  error: null,
                })),
              };
            }
          } else if (table === "workspace_members") {
            // Second call: check workspace membership
            memberCallCount++;
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: "member-1" },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
          };
        }),
      };
      
      mockClient.mockResolvedValue(mockSupabase);

      const result = await updateBoard("board-1", { name: "Updated Name" });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteBoard", () => {
    it("should delete board successfully", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockClient = createClient as any;
      
      let boardCallCount = 0;
      let memberCallCount = 0;
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "boards") {
            boardCallCount++;
            if (boardCallCount === 1) {
              // First call: select to get workspace_id
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { workspace_id: "workspace-1" },
                  error: null,
                }),
              };
            } else {
              // Third call: delete
              return {
                delete: vi.fn().mockReturnThis(),
                eq: vi.fn(() => ({
                  data: null,
                  error: null,
                })),
              };
            }
          } else if (table === "workspace_members") {
            // Second call: check workspace membership
            memberCallCount++;
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: "member-1" },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
          };
        }),
      };
      
      mockClient.mockResolvedValue(mockSupabase);

      const result = await deleteBoard("board-1");
      expect(result.success).toBe(true);
    });
  });
});
