export type LoggerLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  enabled: boolean;
  level: LoggerLevel;
  child(bindings: Record<string, unknown>): Logger;
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
};

const LEVEL_ORDER: Record<LoggerLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(config: {
  enabled?: boolean;
  level?: LoggerLevel;
  bindings?: Record<string, unknown>;
} = {}): Logger {
  const enabled = config.enabled !== false;
  const level = config.level ?? "info";
  const bindings = config.bindings ?? {};

  const log = (entryLevel: LoggerLevel, event: string, fields?: Record<string, unknown>) => {
    if (!enabled || LEVEL_ORDER[entryLevel] < LEVEL_ORDER[level]) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      level: entryLevel,
      event,
      ...bindings,
      ...(fields ?? {}),
    };

    const line = JSON.stringify(payload);
    if (entryLevel === "error" || entryLevel === "warn") {
      console.error(line);
      return;
    }

    console.log(line);
  };

  return {
    enabled,
    level,
    child(nextBindings) {
      return createLogger({
        enabled,
        level,
        bindings: {
          ...bindings,
          ...nextBindings,
        },
      });
    },
    debug(event, fields) {
      log("debug", event, fields);
    },
    info(event, fields) {
      log("info", event, fields);
    },
    warn(event, fields) {
      log("warn", event, fields);
    },
    error(event, fields) {
      log("error", event, fields);
    },
  };
}
