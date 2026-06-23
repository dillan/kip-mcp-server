import type { KipConfig } from './config-builder.js';

export interface AppDataClientOptions {
  /** Signal K server base URL, e.g. http://host:3000 */
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Reads and writes KIP config in the Signal K applicationData store. */
export class SkAppDataClient {
  private readonly base: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AppDataClientOptions) {
    this.base = `${options.baseUrl.replace(/\/$/, '')}/signalk/v1/applicationData/`;
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  private configUrl(scope: string, fileVersion: number, configName: string): string {
    return `${this.base}${scope}/kip/${fileVersion}/${configName}`;
  }

  private patchUrl(scope: string, fileVersion: number): string {
    return `${this.base}${scope}/kip/${fileVersion}`;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string>) };
      if (this.token) headers.authorization = `JWT ${this.token}`;
      const response = await this.fetchImpl(url, { ...init, headers, signal: controller.signal });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Signal K returned HTTP ${response.status} for applicationData. Set SIGNALK_TOKEN, ` +
            `or SIGNALK_USER and SIGNALK_PASSWORD.`,
        );
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Returns the stored config, or null when it does not exist (404). */
  async getConfig(scope: string, configName: string, fileVersion: number): Promise<KipConfig | null> {
    const response = await this.request(this.configUrl(scope, fileVersion, configName), { method: 'GET' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to read config (HTTP ${response.status}).`);
    return (await response.json()) as KipConfig;
  }

  /** Lists the config names stored for a scope. */
  async listConfigNames(scope: string, fileVersion: number): Promise<string[]> {
    const response = await this.request(`${this.base}${scope}/kip/${fileVersion}/?keys=true`, { method: 'GET' });
    if (!response.ok) return [];
    const body = (await response.json()) as unknown;
    return Array.isArray(body) ? body.filter((x): x is string => typeof x === 'string') : [];
  }

  /** Writes a full config (creates or replaces). */
  async postFull(scope: string, configName: string, fileVersion: number, config: unknown): Promise<void> {
    const response = await this.request(this.configUrl(scope, fileVersion, configName), {
      method: 'POST',
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(`Failed to write config (HTTP ${response.status}).`);
  }

  /** Replaces just the dashboards array via JSON Patch. */
  async patchDashboards(scope: string, configName: string, fileVersion: number, dashboards: unknown): Promise<void> {
    const patch = [{ op: 'replace', path: `/${configName}/dashboards`, value: dashboards }];
    const response = await this.request(this.patchUrl(scope, fileVersion), {
      method: 'POST',
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to patch dashboards (HTTP ${response.status}). If the config doesn't exist yet, ` +
          `write a full config first.`,
      );
    }
  }
}
