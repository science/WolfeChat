/**
 * Unit Test: DEBUG Environment Variable Control
 *
 * Tests that debug logging can be controlled via DEBUG environment variable
 * across both unit tests and E2E tests.
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'debug-log-respects-env-var',
  name: 'debugLog helper should respect DEBUG environment variable',
  fn: async (assert) => {
    // Test that debugLog utility exists and works correctly
    let debugLogModule: any = null;
    let importError: Error | null = null;

    try {
      debugLogModule = await import('../utils/debugLog.js');
    } catch (error) {
      importError = error as Error;
    }

    assert.that(!importError, 'debugLog module should be importable');
    assert.that(debugLogModule !== null, 'debugLog module should export functions');

    if (debugLogModule) {
      assert.that(typeof debugLogModule.debugLog === 'function', 'debugLog should be a function');
      assert.that(typeof debugLogModule.DEBUG_LEVELS === 'object', 'DEBUG_LEVELS should be exported');
      assert.that(debugLogModule.DEBUG_LEVELS.ERR === 1, 'DEBUG_LEVELS.ERR should be 1');
      assert.that(debugLogModule.DEBUG_LEVELS.WARN === 2, 'DEBUG_LEVELS.WARN should be 2');
      assert.that(debugLogModule.DEBUG_LEVELS.INFO === 3, 'DEBUG_LEVELS.INFO should be 3');
    }
  }
});

registerTest({
  id: 'debug-log-level-filtering',
  name: 'debugLog should filter messages based on DEBUG level',
  fn: async (assert) => {
    const debugLogModule = await import('../utils/debugLog.js');
    const { debugLog, DEBUG_LEVELS } = debugLogModule;

    // Track console calls
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    let logCalls = 0;
    let warnCalls = 0;
    let errorCalls = 0;

    console.log = () => { logCalls++; };
    console.warn = () => { warnCalls++; };
    console.error = () => { errorCalls++; };

    try {
      // Save original DEBUG value
      const originalDebug = process.env.DEBUG;

      // Test DEBUG=0 (no output)
      process.env.DEBUG = '0';
      logCalls = warnCalls = errorCalls = 0;
      debugLog('test error', DEBUG_LEVELS.ERR);
      debugLog('test warn', DEBUG_LEVELS.WARN);
      debugLog('test info', DEBUG_LEVELS.INFO);
      assert.that(logCalls === 0 && warnCalls === 0 && errorCalls === 0,
        'DEBUG=0 should suppress all output');

      // Test DEBUG=1 (errors only)
      process.env.DEBUG = '1';
      logCalls = warnCalls = errorCalls = 0;
      debugLog('test error', DEBUG_LEVELS.ERR);
      debugLog('test warn', DEBUG_LEVELS.WARN);
      debugLog('test info', DEBUG_LEVELS.INFO);
      assert.that(errorCalls === 1 && warnCalls === 0 && logCalls === 0,
        'DEBUG=1 should show only errors');

      // Test DEBUG=2 (errors + warnings)
      process.env.DEBUG = '2';
      logCalls = warnCalls = errorCalls = 0;
      debugLog('test error', DEBUG_LEVELS.ERR);
      debugLog('test warn', DEBUG_LEVELS.WARN);
      debugLog('test info', DEBUG_LEVELS.INFO);
      assert.that(errorCalls === 1 && warnCalls === 1 && logCalls === 0,
        'DEBUG=2 should show errors and warnings');

      // Test DEBUG=3 (all output)
      process.env.DEBUG = '3';
      logCalls = warnCalls = errorCalls = 0;
      debugLog('test error', DEBUG_LEVELS.ERR);
      debugLog('test warn', DEBUG_LEVELS.WARN);
      debugLog('test info', DEBUG_LEVELS.INFO);
      assert.that(errorCalls === 1 && warnCalls === 1 && logCalls === 1,
        'DEBUG=3 should show all messages');

      // Restore original DEBUG value
      if (originalDebug !== undefined) {
        process.env.DEBUG = originalDebug;
      } else {
        delete process.env.DEBUG;
      }
    } finally {
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    }
  }
});

registerTest({
  id: 'debug-log-convenience-functions',
  name: 'Convenience functions (debugErr, debugWarn, debugInfo) should work',
  fn: async (assert) => {
    const debugLogModule = await import('../utils/debugLog.js');
    const { debugErr, debugWarn, debugInfo } = debugLogModule;

    assert.that(typeof debugErr === 'function', 'debugErr should be exported');
    assert.that(typeof debugWarn === 'function', 'debugWarn should be exported');
    assert.that(typeof debugInfo === 'function', 'debugInfo should be exported');

    // These should not throw errors
    try {
      debugErr('test error message');
      debugWarn('test warning message');
      debugInfo('test info message');
      assert.that(true, 'Convenience functions should execute without errors');
    } catch (error) {
      assert.that(false, `Convenience functions threw error: ${error}`);
    }
  }
});
