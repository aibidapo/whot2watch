type RedactionRule = string | RegExp;

export interface LoggerOptions {
  redactKeys?: RedactionRule[];
  level?: 'debug' | 'info' | 'warn' | 'error';
}

function redact(value: unknown, rules: RedactionRule[]): unknown {
  try {
    if (value && typeof value === 'object') {
      const src = value as Record<string, unknown>;
      const out: Record<string, unknown> = Array.isArray(src)
        ? ([...(src as unknown[])] as unknown as Record<string, unknown>)
        : { ...src };
      for (const key of Object.keys(out)) {
        const shouldRedact = rules.some((r) =>
          typeof r === 'string' ? r === key : (r as RegExp).test(key),
        );
        if (shouldRedact) out[key] = '[REDACTED]';
        else if (out[key] && typeof out[key] === 'object') out[key] = redact(out[key], rules);
      }
      return out;
    }
    return value;
  } catch {
    return value;
  }
}

export class Logger {
  private levelOrder: Record<'debug' | 'info' | 'warn' | 'error', number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };
  private redactRules: RedactionRule[];
  private minLevel: 'debug' | 'info' | 'warn' | 'error';

  constructor(options?: LoggerOptions) {
    this.redactRules = options?.redactKeys ?? [
      'authorization',
      'cookie',
      /token/i,
      /secret/i,
      /password/i,
    ];
    this.minLevel = options?.level ?? 'info';
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    return this.levelOrder[level] >= this.levelOrder[this.minLevel];
  }

  private write(level: 'debug' | 'info' | 'warn' | 'error', msg: string, meta?: unknown) {
    if (!this.shouldLog(level)) return;
    const time = new Date().toISOString();
    const payload = meta ? redact(meta, this.redactRules) : undefined;
    const line = { time, level, msg, ...(payload ? { meta: payload } : {}) };
    // eslint-disable-next-line no-console
    console[level](JSON.stringify(line));
  }

  debug(msg: string, meta?: unknown) {
    this.write('debug', msg, meta);
  }
  info(msg: string, meta?: unknown) {
    this.write('info', msg, meta);
  }
  warn(msg: string, meta?: unknown) {
    this.write('warn', msg, meta);
  }
  error(msg: string, meta?: unknown) {
    this.write('error', msg, meta);
  }
}

export const logger = new Logger({ level: (process.env.LOG_LEVEL as any) || 'info' });

/**
 * Create a named logger instance that prefixes log messages with a module name.
 * Usage: const log = createLogger('mcp-client');
 */
export function createLogger(module: string): Logger & { module: string } {
  const base = new Logger({ level: (process.env.LOG_LEVEL as any) || 'info' });
  const wrapped = {
    module,
    debug(metaOrMsg: unknown, meta?: unknown) {
      if (typeof metaOrMsg === 'string') base.debug(`[${module}] ${metaOrMsg}`, meta);
      else base.debug(`[${module}]`, metaOrMsg);
    },
    info(metaOrMsg: unknown, meta?: unknown) {
      if (typeof metaOrMsg === 'string') base.info(`[${module}] ${metaOrMsg}`, meta);
      else base.info(`[${module}]`, metaOrMsg);
    },
    warn(metaOrMsg: unknown, meta?: unknown) {
      if (typeof metaOrMsg === 'string') base.warn(`[${module}] ${metaOrMsg}`, meta);
      else base.warn(`[${module}]`, metaOrMsg);
    },
    error(metaOrMsg: unknown, meta?: unknown) {
      if (typeof metaOrMsg === 'string') base.error(`[${module}] ${metaOrMsg}`, meta);
      else base.error(`[${module}]`, metaOrMsg);
    },
  };
  return wrapped as Logger & { module: string };
}
