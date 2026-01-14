import { vi } from "vitest";
import { measureTime, measureTimeAsync, benchmark, benchmarkAsync } from "./performance-helpers";

describe("Performance Utilities", () => {
  describe("measureTime", () => {
    it("should measure synchronous function execution time", () => {
      const fn = () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      const { result, duration } = measureTime(fn, "sum calculation");
      expect(result).toBe(499500); // Sum of 0 to 999
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe("measureTimeAsync", () => {
    it("should measure async function execution time", async () => {
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "done";
      };

      const { result, duration } = await measureTimeAsync(fn, "async operation");
      expect(result).toBe("done");
      expect(duration).toBeGreaterThanOrEqual(10);
      expect(duration).toBeLessThan(100);
    });
  });

  describe("benchmark", () => {
    it("should benchmark function with multiple iterations", () => {
      const fn = () => {
        Math.sqrt(123456);
      };

      const metrics = benchmark(fn, 1000, "sqrt calculation");
      expect(metrics.iterations).toBe(1000);
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.operation).toBe("sqrt calculation");
    });

    it("should handle fast operations", () => {
      const fn = () => {
        const x = 1 + 1;
        return x;
      };

      const metrics = benchmark(fn, 10000, "addition");
      expect(metrics.iterations).toBe(10000);
      expect(metrics.duration).toBeGreaterThan(0);
    });
  });

  describe("benchmarkAsync", () => {
    it("should benchmark async function with multiple iterations", async () => {
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
      };

      const metrics = await benchmarkAsync(fn, 10, "async benchmark");
      expect(metrics.iterations).toBe(10);
      expect(metrics.duration).toBeGreaterThanOrEqual(10);
    });
  });
});

describe("Performance Tests - Critical Operations", () => {
  describe("Array Operations", () => {
    it("should handle large array filtering efficiently", () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        active: i % 2 === 0,
      }));

      const { duration } = measureTime(() => {
        largeArray.filter((item) => item.active);
      }, "array filter");

      expect(duration).toBeLessThan(50); // Should be fast
    });

    it("should handle array mapping efficiently", () => {
      const array = Array.from({ length: 1000 }, (_, i) => i);

      const { duration } = measureTime(() => {
        array.map((x) => x * 2);
      }, "array map");

      expect(duration).toBeLessThan(10);
    });
  });

  describe("String Operations", () => {
    it("should handle string concatenation efficiently", () => {
      const strings = Array.from({ length: 1000 }, (_, i) => `string-${i}`);

      const { duration } = measureTime(() => {
        strings.join("");
      }, "string join");

      expect(duration).toBeLessThan(10);
    });

    it("should handle regex matching efficiently", () => {
      const text = "a".repeat(10000);
      const regex = /a+/g;

      const { duration } = measureTime(() => {
        text.match(regex);
      }, "regex match");

      expect(duration).toBeLessThan(50);
    });
  });

  describe("Object Operations", () => {
    it("should handle object creation efficiently", () => {
      const { duration } = measureTime(() => {
        for (let i = 0; i < 1000; i++) {
          const obj = { id: i, name: `Item ${i}`, active: true };
        }
      }, "object creation");

      expect(duration).toBeLessThan(10);
    });

    it("should handle object property access efficiently", () => {
      const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };

      const { duration } = measureTime(() => {
        for (let i = 0; i < 10000; i++) {
          const value = obj.a + obj.b + obj.c;
        }
      }, "property access");

      expect(duration).toBeLessThan(10);
    });
  });
});
