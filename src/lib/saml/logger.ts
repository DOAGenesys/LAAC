// LAAC SAML Logger Utility
// Centralized logging with LOG_LEVEL support

export enum LogLevel {
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

// Get log level from environment variable, default to INFO
const getLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  return envLevel === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO;
};

class SamlLogger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = getLogLevel();
  }

  // Remove emojis from log messages
  private sanitizeMessage(message: string): string {
    // Remove all emoji characters using Unicode ranges
    return message.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  }

  // Log at INFO level
  info(module: string, message: string, ...args: any[]): void {
    const sanitizedMessage = this.sanitizeMessage(message);
    console.log(`[${module}] ${sanitizedMessage}`, ...args);
  }

  // Log at DEBUG level (only shown if LOG_LEVEL=DEBUG)
  debug(module: string, message: string, ...args: any[]): void {
    if (this.logLevel === LogLevel.DEBUG) {
      const sanitizedMessage = this.sanitizeMessage(message);
      console.log(`[${module}] DEBUG: ${sanitizedMessage}`, ...args);
    }
  }

  // Log errors (always shown)
  error(module: string, message: string, ...args: any[]): void {
    const sanitizedMessage = this.sanitizeMessage(message);
    console.error(`[${module}] ERROR: ${sanitizedMessage}`, ...args);
  }

  // Log warnings (always shown)
  warn(module: string, message: string, ...args: any[]): void {
    const sanitizedMessage = this.sanitizeMessage(message);
    console.warn(`[${module}] WARNING: ${sanitizedMessage}`, ...args);
  }

  // Helper methods for different log types with automatic truncation/full logging based on level
  logCertificate(module: string, name: string, cert: string): void {
    if (this.logLevel === LogLevel.DEBUG) {
      this.debug(module, `${name} (FULL):\n${cert}`);
    } else {
      const snippet = cert.length > 30 
        ? `${cert.substring(0, 15)}...${cert.substring(cert.length - 15)}`
        : cert;
      this.info(module, `${name}: ${snippet} (length: ${cert.length})`);
    }
  }

  logBase64Response(module: string, response: string): void {
    if (this.logLevel === LogLevel.DEBUG) {
      this.debug(module, `SAMLResponse (Base64) FULL:\n${response}`);
    } else {
      const preview = response.substring(0, 100);
      this.info(module, `SAMLResponse (Base64) preview: ${preview}***TRUNCATED***`);
    }
    this.info(module, `SAMLResponse (Base64) length: ${response.length}`);
  }

  // Check if debug logging is enabled
  isDebugEnabled(): boolean {
    return this.logLevel === LogLevel.DEBUG;
  }

  // Get current log level
  getCurrentLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Export singleton instance
export const logger = new SamlLogger();
export default logger; 