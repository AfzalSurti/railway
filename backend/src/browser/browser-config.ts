import path from 'path';
import { env } from '../config/env';

export type BrowserRuntimeConfig = {
  headless: boolean;
  timeoutMs: number;
  navigationTimeoutMs: number;
  artifactDir: string;
  retentionDays: number;
  tracingEnabled: boolean;
  saveTraceOnSuccess: boolean;
};

export function getBrowserConfig(): BrowserRuntimeConfig {
  return {
    headless: env.BROWSER_HEADLESS,
    timeoutMs: env.BROWSER_TIMEOUT_MS,
    navigationTimeoutMs: env.BROWSER_NAVIGATION_TIMEOUT_MS,
    artifactDir: path.resolve(process.cwd(), env.BROWSER_ARTIFACT_DIR),
    retentionDays: env.BROWSER_ARTIFACT_RETENTION_DAYS,
    tracingEnabled: env.BROWSER_TRACE,
    saveTraceOnSuccess: env.BROWSER_SAVE_TRACE_ON_SUCCESS,
  };
}
