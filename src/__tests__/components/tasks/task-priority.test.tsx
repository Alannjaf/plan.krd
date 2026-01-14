import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskPriority } from "@/components/tasks/task-priority";

// Mock the mutation hook
vi.mock("@/lib/query/mutations/tasks", () => ({
  useUpdateTask: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// Mock Select component
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <div>{children}</div>,
}));

describe("TaskPriority Component", () => {
  const mockTask = {
    id: "task-1",
    priority: "medium" as const,
    title: "Test Task",
    list_id: "list-1",
    position: 0,
    description: null,
    start_date: null,
    due_date: null,
    archived: false,
    archived_at: null,
    completed: false,
    completed_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assignees: [],
    labels: [],
    subtasks: [],
    custom_field_values: [],
    attachments_count: 0,
    comments_count: 0,
  };

  it("should render priority selector", () => {
    const onChanged = vi.fn();
    render(<TaskPriority task={mockTask} onChanged={onChanged} />);
    // Component should render priority display - use getAllByText since there are multiple
    const priorityElements = screen.getAllByText(/priority/i);
    expect(priorityElements.length).toBeGreaterThan(0);
  });

  it("should display current priority", () => {
    const onChanged = vi.fn();
    render(<TaskPriority task={mockTask} onChanged={onChanged} />);
    // Should show priority label - use getAllByText
    const priorityElements = screen.getAllByText(/priority/i);
    expect(priorityElements.length).toBeGreaterThan(0);
    // Should also show "Medium" for the current priority - use getAllByText
    const mediumElements = screen.getAllByText(/medium/i);
    expect(mediumElements.length).toBeGreaterThan(0);
  });

  it("should handle null priority", () => {
    const taskWithoutPriority = {
      ...mockTask,
      priority: null,
    };
    const onChanged = vi.fn();
    render(<TaskPriority task={taskWithoutPriority} onChanged={onChanged} />);
    // Should handle null gracefully - use getAllByText
    const priorityElements = screen.getAllByText(/priority/i);
    expect(priorityElements.length).toBeGreaterThan(0);
    // Should show "No priority" - use getAllByText
    const noPriorityElements = screen.getAllByText(/no priority/i);
    expect(noPriorityElements.length).toBeGreaterThan(0);
  });
});
