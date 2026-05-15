/**
 * Centralised logger.
 *
 * `__DEV__` gates console output so production builds stay quiet (no PII leak
 * via JS console, no perf overhead on low-end devices). Errors always log so
 * crash reporters (and the dev console) still see them.
 *
 * Usage:
 *   import { logger } from '@/src/utils/logger';
 *   logger.warn('[BLE]', 'scan failed:', err);
 *
 * Tag style — keep the first arg a short bracketed prefix so log filtering by
 * subsystem works the same as before.
 */

type Args = unknown[];

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export const logger = {
  log: (...args: Args) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: Args) => {
    if (isDev) console.warn(...args);
  },
  // Errors always surface — they're needed for crash diagnosis and are
  // typically captured by Sentry/Crashlytics regardless of build mode.
  error: (...args: Args) => {
    console.error(...args);
  },
};
