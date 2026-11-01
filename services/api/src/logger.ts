type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACTED = '[redacted]';
const SENSITIVE_KEY = /(password|token|secret|pin|authorization|voucher|card|cvv|accountnumber|meter|smartcard)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1);
  }
  return output;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.LOG_LEVEL === 'debug') write('debug', message, meta);
  },
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};
