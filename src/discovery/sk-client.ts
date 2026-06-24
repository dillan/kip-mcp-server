/** A thin read client for a Signal K server. */
export interface ServerInfo {
  version: string;
  serverId?: string;
}

export interface PluginInfo {
  id: string;
  enabled: boolean;
  version?: string;
}

export interface SkClientOptions {
  /** Signal K server base URL, e.g. http://host:3000 */
  baseUrl: string;
  /** Optional JWT token (sent as `Authorization: JWT <token>`). */
  token?: string;
  /** Optional async token source (e.g. a username/password login). Preferred over `token`. */
  getToken?: (opts?: { forceRefresh?: boolean }) => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Reuse a successful GET for this many ms, coalescing repeat/concurrent reads. 0 disables. */
  cacheTtlMs?: number;
  /** Injectable clock in ms (defaults to Date.now), for deterministic tests. */
  now?: () => number;
}

export class SkClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly getToken?: (opts?: { forceRefresh?: boolean }) => Promise<string | undefined>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>();

  constructor(options: SkClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.getToken = options.getToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.cacheTtlMs = options.cacheTtlMs ?? 5000;
    this.now = options.now ?? Date.now;
  }

  /**
   * Reads JSON, reusing a recent successful response for up to `cacheTtlMs` so
   * repeat and concurrent reads of the same path hit the server once — pagination
   * pages, back-to-back discovery tools (list/meta/sources), and analyze+validate
   * in one workflow. Only successes are cached; the server's path/unit structure
   * is stable over a few seconds and this client never writes vessel data, so a
   * short TTL needs no invalidation.
   */
  private getJson(path: string): Promise<unknown> {
    if (this.cacheTtlMs <= 0) return this.fetchJson(path, false);
    const hit = this.cache.get(path);
    if (hit && this.now() - hit.at < this.cacheTtlMs) return hit.value;
    const entry = { at: this.now(), value: undefined as unknown as Promise<unknown> };
    entry.value = this.fetchJson(path, false).catch((error: unknown) => {
      if (this.cache.get(path) === entry) this.cache.delete(path); // never cache a failure
      throw error;
    });
    this.cache.set(path, entry);
    return entry.value;
  }

  private async fetchJson(path: string, retried: boolean): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const token = this.getToken ? await this.getToken() : this.token;
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `JWT ${token}`;
      const response = await this.fetchImpl(url, { headers, signal: controller.signal });
      if (response.status === 401 || response.status === 403) {
        // The token may have expired: ask for a fresh one and, if it actually
        // changed, retry the request exactly once before giving up.
        if (this.getToken && !retried) {
          const fresh = await this.getToken({ forceRefresh: true });
          if (fresh && fresh !== token) return this.fetchJson(path, true);
        }
        throw new Error(
          `Signal K returned HTTP ${response.status} for ${path}. ` +
            `Set SIGNALK_TOKEN, or SIGNALK_USER and SIGNALK_PASSWORD.`,
        );
      }
      if (!response.ok) {
        throw new Error(`Signal K returned HTTP ${response.status} for ${path}.`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async getServerInfo(): Promise<ServerInfo> {
    const body = (await this.getJson('/signalk')) as {
      server?: { id?: string; version?: string };
      version?: string;
    };
    const version = body.server?.version ?? body.version ?? 'unknown';
    return body.server?.id ? { version, serverId: body.server.id } : { version };
  }

  async getVesselSelf(): Promise<Record<string, unknown>> {
    return (await this.getJson('/signalk/v1/api/vessels/self')) as Record<string, unknown>;
  }

  /** Lists installed plugins. Returns [] when the endpoint is unavailable or unauthorized. */
  async getPlugins(): Promise<PluginInfo[]> {
    try {
      const body = (await this.getJson('/skServer/plugins')) as Array<{
        id?: string;
        enabled?: boolean;
        version?: string;
      }>;
      if (!Array.isArray(body)) return [];
      return body
        .filter(
          (p): p is { id: string; enabled?: boolean; version?: string } => typeof p.id === 'string',
        )
        .map((p) =>
          p.version
            ? { id: p.id, enabled: p.enabled === true, version: p.version }
            : { id: p.id, enabled: p.enabled === true },
        );
    } catch {
      return [];
    }
  }
}
