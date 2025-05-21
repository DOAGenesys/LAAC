/**
 * Simple logger with consistent formatting and metadata
 * This could be replaced with a more robust logging solution (e.g., Winston, Pino) in the future
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMetadata {
  [key: string]: string | number | boolean | null | undefined | Record<string, string | number | boolean>;
}

interface LogEvent {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
}

// In production, this could be integrated with a log management system
export function log(level: LogLevel, message: string, metadata?: LogMetadata): void {
  const event: LogEvent = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata
  };

  // In production, you might implement different handlers based on the environment
  if (process.env.NODE_ENV === 'production') {
    // Format for production logs (could be sent to a logging service)
    console[level](JSON.stringify(event));
  } else {
    // More readable format for development
    console[level](
      `[${event.timestamp}] ${level.toUpperCase()}: ${message}`,
      metadata ? metadata : ''
    );
  }
}

// Convenience methods
export const info = (message: string, metadata?: LogMetadata) => log('info', message, metadata);
export const warn = (message: string, metadata?: LogMetadata) => log('warn', message, metadata);
export const error = (message: string, metadata?: LogMetadata) => log('error', message, metadata);
export const debug = (message: string, metadata?: LogMetadata) => {
  if (process.env.NODE_ENV !== 'production') {
    log('debug', message, metadata);
  }
};

// Custom metrics
interface MetricEvent {
  name: string;
  value?: number;
  tags?: Record<string, string | number | boolean>;
}

export function emitMetric(metric: MetricEvent): void {
  // In a real app, this would send the metric to your monitoring system
  // For now, we just log it
  info(`METRIC: ${metric.name}`, {
    value: metric.value || 1,
    tags: metric.tags
  });
}

export default {
  log,
  info,
  warn,
  error,
  debug,
  emitMetric
}; 