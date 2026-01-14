import { z } from "zod";

/**
 * Environment variables schema
 */
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  
  // OpenRouter AI
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required").optional(),
  
  // App URL (optional, defaults to localhost in dev)
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),
  
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validated environment variables
 */
type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Get validated environment variables
 * Throws error if validation fails
 */
export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  const rawEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.issues.map((e) => {
      const path = e.path.length > 0 ? e.path.join(".") : "root";
      return `${path}: ${e.message}`;
    }).join("\n");
    throw new Error(`Environment variable validation failed:\n${errors}`);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Validate environment variables on module load (server-side only)
 */
if (typeof window === "undefined") {
  try {
    getEnv();
  } catch (error) {
    // Only throw in production to prevent blocking development
    if (process.env.NODE_ENV === "production") {
      throw error;
    } else {
      console.warn("Environment validation warning:", error instanceof Error ? error.message : String(error));
    }
  }
}
