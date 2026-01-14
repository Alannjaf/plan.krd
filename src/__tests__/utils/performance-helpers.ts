/**
 * Performance testing utilities
 * Extracted from performance.test.ts for reuse
 */

interface PerformanceMetrics {
  operation: string;
  duration: number;
  memory?: number;
  iterations?: number;
}

/**
 * Measure execution time of a function
 */
export function measureTime<T>(fn: () => T, operation: string = "operation"): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;
  return { result, duration };
}

/**
 * Measure execution time of an async function
 */
export async function measureTimeAsync<T>(
  fn: () => Promise<T>,
  operation: string = "operation"
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;
  return { result, duration };
}

/**
 * Benchmark a function with multiple iterations
 */
export function benchmark(
  fn: () => void,
  iterations: number = 1000,
  operation: string = "operation"
): PerformanceMetrics {
  const start = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize;

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  const end = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize;
  const duration = end - start;
  const memory = endMemory && startMemory ? endMemory - startMemory : undefined;

  return {
    operation,
    duration,
    memory,
    iterations,
  };
}

/**
 * Benchmark an async function with multiple iterations
 */
export async function benchmarkAsync(
  fn: () => Promise<void>,
  iterations: number = 100,
  operation: string = "operation"
): Promise<PerformanceMetrics> {
  const start = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize;

  for (let i = 0; i < iterations; i++) {
    await fn();
  }

  const end = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize;
  const duration = end - start;
  const memory = endMemory && startMemory ? endMemory - startMemory : undefined;

  return {
    operation,
    duration,
    memory,
    iterations,
  };
}
