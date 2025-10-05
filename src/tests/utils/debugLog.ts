/**
 * Centralized Debug Logging for Unit Tests
 *
 * All console output in unit tests should go through this helper to enable
 * centralized control of debug verbosity via DEBUG environment variable.
 *
 * Usage:
 *   import { debugLog, DEBUG_LEVELS } from '../utils/debugLog';
 *   debugLog('Setting up test data', DEBUG_LEVELS.INFO);
 *   debugLog('API call failed', DEBUG_LEVELS.ERR, { error: err });
 *
 * Environment variable DEBUG controls output:
 *   DEBUG=0 or unset: No output (default)
 *   DEBUG=1: Only errors (ERR level)
 *   DEBUG=2: Errors and warnings (ERR + WARN levels)
 *   DEBUG=3: All output (ERR + WARN + INFO levels)
 */

// Debug level constants
export const DEBUG_LEVELS = {
  ERR: 1,   // Critical errors, test failures, exceptions
  WARN: 2,  // Warnings, important notifications, fallbacks
  INFO: 3   // General info, step-by-step logging, diagnostics
} as const;

// Type for debug levels
export type DebugLevel = typeof DEBUG_LEVELS[keyof typeof DEBUG_LEVELS];

/**
 * Central debug logging function
 * Only place where DEBUG environment variable should be checked
 *
 * @param message - The message to log
 * @param level - Debug level (use DEBUG_LEVELS constants)
 * @param extras - Additional data for future extensibility (can include error objects, etc.)
 */
export function debugLog(
  message: string,
  level: DebugLevel,
  extras: Record<string, any> = {}
): void {
  // Get current debug level from environment
  const currentDebugLevel = Number(process.env.DEBUG || '0');

  // Only log if the message level is at or below the current debug level
  if (level <= currentDebugLevel) {
    // Format the message with appropriate prefix
    const prefix = getLogPrefix(level);
    const formattedMessage = `${prefix} ${message}`;

    // Choose appropriate console method based on level
    switch (level) {
      case DEBUG_LEVELS.ERR:
        if (Object.keys(extras).length > 0) {
          console.error(formattedMessage, extras);
        } else {
          console.error(formattedMessage);
        }
        break;

      case DEBUG_LEVELS.WARN:
        if (Object.keys(extras).length > 0) {
          console.warn(formattedMessage, extras);
        } else {
          console.warn(formattedMessage);
        }
        break;

      case DEBUG_LEVELS.INFO:
      default:
        if (Object.keys(extras).length > 0) {
          console.log(formattedMessage, extras);
        } else {
          console.log(formattedMessage);
        }
        break;
    }
  }
}

/**
 * Get appropriate log prefix for the debug level
 */
function getLogPrefix(level: DebugLevel): string {
  switch (level) {
    case DEBUG_LEVELS.ERR:
      return '[TEST-ERR]';
    case DEBUG_LEVELS.WARN:
      return '[TEST-WARN]';
    case DEBUG_LEVELS.INFO:
      return '[TEST-INFO]';
    default:
      return '[TEST]';
  }
}

/**
 * Convenience functions for common logging patterns
 */
export const debugErr = (message: string, extras?: Record<string, any>) =>
  debugLog(message, DEBUG_LEVELS.ERR, extras);

export const debugWarn = (message: string, extras?: Record<string, any>) =>
  debugLog(message, DEBUG_LEVELS.WARN, extras);

export const debugInfo = (message: string, extras?: Record<string, any>) =>
  debugLog(message, DEBUG_LEVELS.INFO, extras);

/**
 * Helper to check if a specific debug level is enabled
 * Useful for expensive operations that should only run when debugging
 */
export function isDebugLevel(level: DebugLevel): boolean {
  const currentDebugLevel = Number(process.env.DEBUG || '0');
  return level <= currentDebugLevel;
}
