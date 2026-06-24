/**
 * Connection diagnostics: run a sequence of checks against the live Signal K
 * server and KIP install, and report each as pass/warn/fail/skip with plain
 * guidance. Shared by the `check_connection` MCP tool and the `--doctor` CLI flag.
 */
import type { ServerConfig } from './config.js';
import type { SkClient } from './discovery/sk-client.js';
import type { LoadResult } from './schema/kip-schema.js';
import { supportsApplicationData } from './write/apply-plan.js';

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
  /** Loads the KIP schema for the configured KIP base URL (a closure over kipBaseUrl). */
  loadSchema: () => Promise<LoadResult>;
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runDoctor(deps: DoctorDeps): Promise<DoctorReport> {
  const { config, sk, loadSchema } = deps;
  const checks: CheckResult[] = [];
  let version: string | undefined;
  let reachable = false;

  // Check 1: server reachable. For username/password auth this also triggers the
  // login (every request resolves the token first), so a bad login fails here.
  try {
    const info = await sk.getServerInfo();
    version = info.version;
    reachable = true;
    checks.push({
      id: 'signalk_reachable',
      label: 'Signal K server reachable',
      severity: 'pass',
      detail: `Signal K ${info.version} at ${config.signalkBaseUrl}`,
    });
  } catch (error) {
    checks.push({
      id: 'signalk_reachable',
      label: 'Signal K server reachable',
      severity: 'fail',
      detail: errMsg(error),
      guidance: `Check the server is running and reachable at ${config.signalkBaseUrl} (SIGNALK_HOST / SIGNALK_PORT / SIGNALK_TLS), and that any SIGNALK_TOKEN or SIGNALK_USER/SIGNALK_PASSWORD are valid.`,
    });
  }

  // Check 2: applicationData write support (needs the version from check 1).
  if (!reachable) {
    checks.push({
      id: 'applicationdata_supported',
      label: 'applicationData store (write support)',
      severity: 'skip',
      detail: 'Skipped — Signal K was not reachable.',
    });
  } else if (supportsApplicationData(version ?? '')) {
    checks.push({
      id: 'applicationdata_supported',
      label: 'applicationData store (write support)',
      severity: 'pass',
      detail: `Signal K ${version} supports the applicationData store (>= 1.27).`,
    });
  } else {
    checks.push({
      id: 'applicationdata_supported',
      label: 'applicationData store (write support)',
      severity: 'warn',
      detail: `Signal K ${version} is below 1.27.`,
      guidance:
        'Writing dashboards to the server is unavailable; apply_kip_config will fall back to a KipConfig.json file you import via KIP Settings.',
    });
  }

  // Check 3: the live KIP schema asset (independent of check 1).
  try {
    const result = await loadSchema();
    if (result.source === 'remote') {
      checks.push({
        id: 'kip_schema_served',
        label: 'KIP schema asset served',
        severity: 'pass',
        detail: `Live KIP schema served (KIP ${result.schema.meta.kipVersion}).`,
      });
    } else {
      checks.push({
        id: 'kip_schema_served',
        label: 'KIP schema asset served',
        severity: 'warn',
        detail: result.warning ?? 'Using the bundled schema fallback.',
        guidance: `Check KIP is installed and served at ${config.kipBaseUrl} (override with KIP_URL).`,
      });
    }
  } catch (error) {
    checks.push({
      id: 'kip_schema_served',
      label: 'KIP schema asset served',
      severity: 'fail',
      detail: errMsg(error),
      guidance: `The KIP schema asset needs a valid login. Set SIGNALK_TOKEN, or SIGNALK_USER and SIGNALK_PASSWORD; also verify KIP_URL (${config.kipBaseUrl}).`,
    });
  }

  // Check 4: authentication, only meaningful when credentials are configured.
  const hasCreds = Boolean(config.token || config.credentials);
  if (!hasCreds) {
    checks.push({
      id: 'auth_ok',
      label: 'Authentication',
      severity: 'pass',
      detail: 'No credentials configured; accessing Signal K anonymously.',
    });
  } else if (!reachable) {
    checks.push({
      id: 'auth_ok',
      label: 'Authentication',
      severity: 'skip',
      detail: 'Skipped — Signal K was not reachable.',
    });
  } else {
    try {
      await sk.getVesselSelf();
      checks.push({
        id: 'auth_ok',
        label: 'Authentication',
        severity: 'pass',
        detail: 'Credentials accepted (vessels/self is readable).',
      });
    } catch (error) {
      checks.push({
        id: 'auth_ok',
        label: 'Authentication',
        severity: 'fail',
        detail: errMsg(error),
        guidance:
          'Signal K rejected the credentials. Re-check SIGNALK_TOKEN, or SIGNALK_USER and SIGNALK_PASSWORD.',
      });
    }
  }

  const fails = checks.filter((c) => c.severity === 'fail').length;
  const warns = checks.filter((c) => c.severity === 'warn').length;
  const ok = fails === 0;
  const summary = ok
    ? warns > 0
      ? `All clear, with ${warns} warning${warns === 1 ? '' : 's'}.`
      : 'All checks passed.'
    : `${fails} problem${fails === 1 ? '' : 's'} found.`;
  return { ok, checks, summary };
}

const ICONS: Record<Severity, string> = { pass: 'OK', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' };

export function formatDoctorReport(report: DoctorReport): string {
  const lines = report.checks.map((c) => `[${ICONS[c.severity]}] ${c.label}: ${c.detail}`);
  const guidance = report.checks.filter(
    (c) => c.guidance && (c.severity === 'warn' || c.severity === 'fail'),
  );
  if (guidance.length) {
    lines.push('', 'Guidance:');
    for (const c of guidance) lines.push(`  - ${c.label}: ${c.guidance}`);
  }
  lines.push('', report.summary);
  return lines.join('\n');
}
