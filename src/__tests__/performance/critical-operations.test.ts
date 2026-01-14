import { measureTime, benchmark } from "../utils/performance-helpers";

describe("Performance Tests - Critical Operations", () => {
  describe("Data Transformation Performance", () => {
    it("should transform task data efficiently", () => {
      const tasks = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        assignees: Array.from({ length: 3 }, (_, j) => ({
          id: `assignee-${j}`,
          profiles: { id: `user-${j}`, email: `user${j}@test.com` },
        })),
        labels: Array.from({ length: 2 }, (_, j) => ({
          id: `label-${j}`,
          labels: { id: `label-${j}`, name: `Label ${j}`, color: "#000" },
        })),
      }));

      const { duration } = measureTime(() => {
        tasks.map((task) => ({
          ...task,
          assigneeCount: task.assignees.length,
          labelCount: task.labels.length,
        }));
      }, "task transformation");

      expect(duration).toBeLessThan(50); // Should be fast
    });

    it("should filter and sort tasks efficiently", () => {
      const tasks = Array.from({ length: 5000 }, (_, i) => ({
        id: `task-${i}`,
        priority: ["low", "medium", "high", "urgent"][i % 4] as any,
        completed: i % 2 === 0,
      }));

      const { duration } = measureTime(() => {
        tasks
          .filter((t) => !t.completed)
          .sort((a, b) => {
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            return (
              (priorityOrder[b.priority || "low"] || 0) -
              (priorityOrder[a.priority || "low"] || 0)
            );
          });
      }, "filter and sort");

      expect(duration).toBeLessThan(100);
    });
  });

  describe("String Processing Performance", () => {
    it("should extract mentions efficiently from large text", async () => {
      const { extractMentions } = await import("@/lib/utils/mentions");
      const largeText = "Hey @user1, @user2, and @user3. ".repeat(1000);

      const { duration } = measureTime(() => {
        extractMentions(largeText);
      }, "mention extraction");

      expect(duration).toBeLessThan(50);
    });

    it("should format activity messages efficiently", async () => {
      const { getActivityMessage } = await import("@/lib/utils/activity-messages");
      const activities = Array.from({ length: 1000 }, (_, i) => ({
        id: `activity-${i}`,
        task_id: `task-${i}`,
        action: "updated" as const,
        changes: {},
        created_at: new Date().toISOString(),
        user_id: `user-${i}`,
      }));

      const { duration } = measureTime(() => {
        activities.forEach((activity) => {
          getActivityMessage(activity, "User");
        });
      }, "activity message formatting");

      expect(duration).toBeLessThan(100);
    });
  });

  describe("Array Operations Performance", () => {
    it("should handle large array operations efficiently", () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: Math.random(),
      }));

      const metrics = benchmark(() => {
        largeArray
          .filter((item) => item.value > 0.5)
          .map((item) => ({ ...item, doubled: item.value * 2 }))
          .sort((a, b) => a.doubled - b.doubled);
      }, 10, "large array operations");

      expect(metrics.duration).toBeLessThan(1000); // 10 iterations should be fast
    });

    it("should handle array grouping efficiently", () => {
      const items = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        category: `category-${i % 10}`,
      }));

      const { duration } = measureTime(() => {
        const grouped = items.reduce((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = [];
          }
          acc[item.category].push(item);
          return acc;
        }, {} as Record<string, typeof items>);
      }, "array grouping");

      expect(duration).toBeLessThan(50);
    });
  });

  describe("Object Operations Performance", () => {
    it("should merge objects efficiently", () => {
      const objects = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: { a: i, b: i * 2, c: i * 3 },
      }));

      const { duration } = measureTime(() => {
        objects.reduce((acc, obj) => ({ ...acc, ...obj.data }), {});
      }, "object merging");

      expect(duration).toBeLessThan(100);
    });

    it("should create task objects efficiently", () => {
      const { duration } = measureTime(() => {
        for (let i = 0; i < 1000; i++) {
          const task = {
            id: `task-${i}`,
            title: `Task ${i}`,
            description: `Description ${i}`,
            priority: ["low", "medium", "high"][i % 3] as any,
            assignees: [],
            labels: [],
            subtasks: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }, "task object creation");

      expect(duration).toBeLessThan(50);
    });
  });

  describe("Validation Performance", () => {
    it("should validate task schemas efficiently", async () => {
      const { createTaskSchema } = await import("@/lib/validations/tasks");
      const validInputs = Array.from({ length: 1000 }, (_, i) => ({
        listId: "123e4567-e89b-12d3-a456-426614174000",
        title: `Task ${i}`,
        priority: ["low", "medium", "high"][i % 3] as any,
      }));

      const { duration } = measureTime(() => {
        validInputs.forEach((input) => {
          createTaskSchema.safeParse(input);
        });
      }, "task schema validation");

      expect(duration).toBeLessThan(200);
    });

    it("should validate board schemas efficiently", async () => {
      const { createBoardSchema } = await import("@/lib/validations/boards");
      const validInputs = Array.from({ length: 1000 }, (_, i) => ({
        workspaceId: "123e4567-e89b-12d3-a456-426614174000",
        name: `Board ${i}`,
      }));

      const { duration } = measureTime(() => {
        validInputs.forEach((input) => {
          createBoardSchema.safeParse(input);
        });
      }, "board schema validation");

      expect(duration).toBeLessThan(200);
    });
  });

  describe("Memory Efficiency", () => {
    it("should not create excessive memory allocations", () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and process large dataset
      const tasks = Array.from({ length: 10000 }, (_, i) => ({
        id: `task-${i}`,
        data: new Array(100).fill(i),
      }));

      tasks.forEach((task) => {
        const processed = {
          ...task,
          processed: true,
        };
      });

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for this test)
      if (memoryIncrease > 0) {
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      }
    });
  });
});
