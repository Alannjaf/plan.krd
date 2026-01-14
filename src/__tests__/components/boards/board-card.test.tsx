import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoardCard } from "@/components/boards/board-card";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}));

// Mock mutation hooks
vi.mock("@/lib/query/mutations/boards", () => ({
  useArchiveBoard: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUnarchiveBoard: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateBoard: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteBoard: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

describe("BoardCard Component", () => {
  const mockBoard = {
    id: "board-1",
    name: "Test Board",
    description: "Test description",
    workspace_id: "workspace-1",
    position: 0,
    archived: false,
    archived_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    public_token: null,
    public_enabled: false,
  };

  it("should render board name", () => {
    render(<BoardCard board={mockBoard} workspaceId="workspace-1" />);
    expect(screen.getByText("Test Board")).toBeInTheDocument();
  });

  it("should render board description when provided", () => {
    render(<BoardCard board={mockBoard} workspaceId="workspace-1" />);
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("should handle missing description", () => {
    const boardWithoutDescription = {
      ...mockBoard,
      description: null,
    };
    render(<BoardCard board={boardWithoutDescription} workspaceId="workspace-1" />);
    expect(screen.getByText("Test Board")).toBeInTheDocument();
  });
});
