/**
 * Connection diagnostics: run a sequence of checks against the live Signal K
 * server and KIP install, and report each as pass/warn/fail/skip with plain
 * guidance. Shared by the `check_connection` MCP tool and the `--doctor` CLI flag.
 */
import type { ServerConfig } from './config.js';
import type { SkClient } from './discovery/sk-client.js';
import type { LoadOptions, LoadResult } from './schema/kip-schema.js';

export type Severity = 'pass' | 'warn' | 'fail' | 'skip';

export interface CheckResult {
  id: string;
  label: string;
  severity: Severity;
  detail: string;
  guidance?: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: CheckResult[];
  summary: string;
}

export interface DoctorDeps {
  config: ServerConfig;
  sk: SkClient;
  loadSchema: (opts: LoadOptions) => Promise<LoadResult>;
}

export async function runDoctor(_deps: DoctorDeps): Promise<DoctorReport> {
  throw new Error('runDoctor not implemented');
}

export function formatDoctorReport(_report: DoctorReport): string {
  throw new Error('formatDoctorReport not implemented');
}
