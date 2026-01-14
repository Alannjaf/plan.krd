/**
 * Sentry error tracking integration
 * Install @sentry/nextjs for full integration
 */

type SentryConfig = {
  dsn?: string;
  environment?: string;
  enabled?: boolean;
};

let sentryInitialized = false;

/**
 * Initialize Sentry (client-side)
 * Call this in your app initialization
 */
export function initSentry(config: SentryConfig = {}): void {
  if (sentryInitialized || typeof window === "undefined") {
    return;
  }

  // Only initialize if DSN is provided
  if (!config.dsn || !config.enabled) {
    return;
  }

  try {
    // Dynamic import to avoid bundling Sentry in development
    if (process.env.NODE_ENV === "production") {
      // Uncomment when @sentry/nextjs is installed:
      // import * as Sentry from "@sentry/nextjs";
      // Sentry.init({
      //   dsn: config.dsn,
      //   environment: config.environment || "production",
      //   tracesSampleRate: 1.0,
      //   replaysSessionSampleRate: 0.1,
      //   replaysOnErrorSampleRate: 1.0,
      // });
    }
    sentryInitialized = true;
  } catch (error) {
    console.error("Failed to initialize Sentry:", error);
  }
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !sentryInitialized) {
    return;
  }

  try {
    // Uncomment when @sentry/nextjs is installed:
    // import * as Sentry from "@sentry/nextjs";
    // Sentry.captureException(error, {
    //   extra: context,
    // });
    console.error("Exception (would be sent to Sentry):", error, context);
  } catch (err) {
    console.error("Failed to capture exception:", err);
  }
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (typeof window === "undefined" || !sentryInitialized) {
    return;
  }

  try {
    // Uncomment when @sentry/nextjs is installed:
    // import * as Sentry from "@sentry/nextjs";
    // Sentry.captureMessage(message, level);
    console.log(`Message (would be sent to Sentry): [${level}] ${message}`);
  } catch (error) {
    console.error("Failed to capture message:", error);
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (typeof window === "undefined" || !sentryInitialized) {
    return;
  }

  try {
    // Uncomment when @sentry/nextjs is installed:
    // import * as Sentry from "@sentry/nextjs";
    // Sentry.setUser(user);
  } catch (error) {
    console.error("Failed to set user:", error);
  }
}
