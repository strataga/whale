/**
 * #22 Structured logging utility.
 * JSON-line output in production, human-readable in dev.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatDev(entry: LogEntry): string {
  const color = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  }[entry.level];
  const reset = "\x1b[0m";
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
  const rid = entry.requestId ? ` [${entry.requestId.slice(0, 8)}]` : "";
  return `${color}[${entry.level.toUpperCase()}]${reset}${rid} ${entry.message}${ctx}`;
}

function emit(entry: LogEntry) {
  if (!shouldLog(entry.level)) return;

  const isDev = process.env.NODE_ENV !== "production";
  const output = isDev ? formatDev(entry) : JSON.stringify(entry);

  if (entry.level === "error") {
    console.error(output);
  } else if (entry.level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export function createLogger(defaultContext?: Record<string, unknown>) {
  function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    emit({
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...defaultContext, ...context },
    });
  }

  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  };
}

export const logger = createLogger();
