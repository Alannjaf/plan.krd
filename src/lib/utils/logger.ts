/**
 * Structured logging utility
 * Replaces console.log/error with structured logging
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context || "");
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context || "");
    }
    // In production, could send to logging service
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context || "");
    // In production, could send to logging service
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };

    console.error(`[ERROR] ${message}`, errorContext);

    // In production, send to error tracking service (Sentry)
    if (this.isProduction && typeof window !== "undefined") {
      // Dynamic import to avoid bundling in development
      import("./sentry").then(({ captureException }) => {
        if (error instanceof Error) {
          captureException(error, errorContext);
        }
      }).catch(() => {
        // Sentry not available, ignore
      });
    }
  }

  /**
   * Log with request ID for tracing
   */
  withRequestId(requestId: string) {
    return {
      debug: (message: string, context?: LogContext) =>
        this.debug(message, { ...context, requestId }),
      info: (message: string, context?: LogContext) =>
        this.info(message, { ...context, requestId }),
      warn: (message: string, context?: LogContext) =>
        this.warn(message, { ...context, requestId }),
      error: (message: string, error?: Error | unknown, context?: LogContext) =>
        this.error(message, error, { ...context, requestId }),
    };
  }
}

export const logger = new Logger();

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
