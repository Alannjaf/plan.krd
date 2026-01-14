import { vi } from "vitest";

describe("Environment Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset module cache to allow re-validation
    vi.resetModules();
    // Clear the validated env cache
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("should validate and return env vars when all required vars are present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.NODE_ENV = "test";

    // Need to re-import to get fresh validation
    vi.resetModules();
    const { getEnv } = await import("@/lib/env");

    const env = getEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
    expect(env.NODE_ENV).toBe("test");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000"); // Default value
  });

  it("should throw error when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    vi.resetModules();
    const { getEnv } = await import("@/lib/env");

    expect(() => getEnv()).toThrow("Environment variable validation failed");
  });

  it("should throw error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    vi.resetModules();
    const { getEnv } = await import("@/lib/env");

    expect(() => getEnv()).toThrow("Environment variable validation failed");
  });

  it("should throw error with invalid URL format", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-valid-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    vi.resetModules();
    const { getEnv } = await import("@/lib/env");

    expect(() => getEnv()).toThrow("Environment variable validation failed");
  });

  it("should accept optional OPENROUTER_API_KEY", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    process.env.OPENROUTER_API_KEY = "optional-key";

    vi.resetModules();
    const { getEnv } = await import("@/lib/env");

    const env = getEnv();
    expect(env.OPENROUTER_API_KEY).toBe("optional-key");
  });

  it("should use default value for NEXT_PUBLIC_APP_URL when not provided", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    delete process.env.NEXT_PUBLIC_APP_URL;

    vi.resetModules();
    const { getEnv } = await import("@/lib/env");

    const env = getEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("should validate NODE_ENV enum values", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    process.env.NODE_ENV = "invalid-env";

    vi.resetModules();
    const { getEnv } = await import("@/lib/env");

    expect(() => getEnv()).toThrow("Environment variable validation failed");
  });

  it("should accept valid NODE_ENV values", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    for (const env of ["development", "production", "test"] as const) {
      process.env.NODE_ENV = env;
      vi.resetModules();
      const { getEnv } = await import("@/lib/env");

      const result = getEnv();
      expect(result.NODE_ENV).toBe(env);
    }
  });
});
