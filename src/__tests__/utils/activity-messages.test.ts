import { getActivityMessage } from "@/lib/utils/activity-messages";
import type { TaskActivity } from "@/lib/actions/activities";

describe("Activity Messages", () => {
  const userName = "John Doe";

  describe("getActivityMessage", () => {
    it("should format created activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "created",
        changes: {},
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe created this task");
    });

    it("should format updated activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "updated",
        changes: {},
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe updated the task");
    });

    it("should format moved activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "moved",
        changes: { from: "Todo", to: "Done" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe('John Doe moved the task from "Todo" to "Done"');
    });

    it("should format assigned activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "assigned",
        changes: { assignee: "Jane Smith" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe assigned Jane Smith to this task");
    });

    it("should format unassigned activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "unassigned",
        changes: { assignee: "Jane Smith" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe removed Jane Smith from this task");
    });

    it("should format label_added activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "label_added",
        changes: { label: "Bug" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe('John Doe added label "Bug"');
    });

    it("should format label_removed activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "label_removed",
        changes: { label: "Bug" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe('John Doe removed label "Bug"');
    });

    it("should format subtask_added activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "subtask_added",
        changes: { title: "Subtask 1" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe('John Doe added subtask "Subtask 1"');
    });

    it("should format subtask_completed activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "subtask_completed",
        changes: { title: "Subtask 1" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe('John Doe completed subtask "Subtask 1"');
    });

    it("should format due_date_changed activity with from and to", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "due_date_changed",
        changes: { from: "2024-01-01", to: "2024-01-15" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe changed due date from 2024-01-01 to 2024-01-15");
    });

    it("should format due_date_changed activity with only to", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "due_date_changed",
        changes: { to: "2024-01-15" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe set due date to 2024-01-15");
    });

    it("should format due_date_changed activity with removed date", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "due_date_changed",
        changes: {},
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe removed due date");
    });

    it("should format priority_changed activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "priority_changed",
        changes: { from: "low", to: "high" },
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe('John Doe changed priority from "low" to "high"');
    });

    it("should format description_changed activity", () => {
      const activity: TaskActivity = {
        id: "1",
        task_id: "task-1",
        action: "description_changed",
        changes: {},
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe updated the description");
    });

    it("should handle unknown action with default message", () => {
      const activity = {
        id: "1",
        task_id: "task-1",
        action: "unknown_action" as any,
        changes: {},
        created_at: new Date().toISOString(),
        user_id: "user-1",
      };

      const message = getActivityMessage(activity, userName);
      expect(message).toBe("John Doe made changes");
    });
  });
});
