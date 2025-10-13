/**
 * Environment-aware logging utility
 * Prevents console spam in production builds while maintaining useful logs in development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabledInProduction: boolean;
  enabledInBuild: boolean;
  enabledInDevelopment: boolean;
  enabledInTest: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  enabledInProduction: false,
  enabledInBuild: false,
  enabledInDevelopment: false, // Temporarily disabled for troubleshooting
  enabledInTest: false,
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private shouldLog(): boolean {
    const env = process.env.NODE_ENV;
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
    
    if (isBuildTime) return this.config.enabledInBuild;
    
    switch (env) {
      case 'production':
        return this.config.enabledInProduction;
      case 'development':
        return this.config.enabledInDevelopment;
      case 'test':
        return this.config.enabledInTest;
      default:
        return false;
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog()) {
          }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog()) {
      console.info(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog()) {
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    // Always log errors regardless of environment
    console.error(message, ...args);
  }
}

// Pre-configured loggers for different components
export const prismaLogger = new Logger({
  enabledInProduction: false,
  enabledInBuild: false,
  enabledInDevelopment: false, // Temporarily disabled for troubleshooting
  enabledInTest: false,
});

export const authLogger = new Logger({
  enabledInProduction: false,
  enabledInBuild: false,
  enabledInDevelopment: false, // Temporarily disabled for troubleshooting
  enabledInTest: false,
});

export const uiLogger = new Logger({
  enabledInProduction: false,
  enabledInBuild: false,
  enabledInDevelopment: false,
  enabledInTest: false,
});

// General logger
export const logger = new Logger();

// Export default logger
export default logger;
