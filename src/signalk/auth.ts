/**
 * Signal K authentication: turn a username and password into a JWT, and provide
 * a single token source for the read and write clients.
 */

export interface Credentials {
  username: string;
  password: string;
}

/**
 * Logs in to Signal K and returns a JWT. Throws a clear error if the login is
 * rejected or returns no token.
 */
export async function signalkLogin(
  baseUrl: string,
  credentials: Credentials,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/signalk/v1/auth/login`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: credentials.username, password: credentials.password }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Signal K rejected the login (HTTP ${response.status}). Check SIGNALK_USER and ` +
        `SIGNALK_PASSWORD.`,
    );
  }
  if (!response.ok) {
    throw new Error(`Signal K login failed (HTTP ${response.status}).`);
  }
  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error('Signal K login succeeded but returned no token.');
  }
  return body.token;
}

export interface TokenProviderOptions {
  baseUrl: string;
  token?: string;
  credentials?: Credentials;
  fetchImpl?: typeof fetch;
}

/**
 * Resolves the auth token for Signal K requests: a static token when one is set,
 * otherwise a username/password login that runs once and is then reused.
 */
export class TokenProvider {
  private readonly options: TokenProviderOptions;
  private pending?: Promise<string>;

  constructor(options: TokenProviderOptions) {
    this.options = options;
  }

  /**
   * Returns a token, or undefined when no auth is configured.
   *
   * Pass `{ forceRefresh: true }` after a request was rejected (401/403) to drop
   * the cached login and authenticate again. A static `SIGNALK_TOKEN` can't be
   * re-derived, so `forceRefresh` returns it unchanged.
   *
   * Concurrent forced refreshes are not coalesced: if several requests are
   * rejected in the same tick they may each re-login. That is bounded (by the
   * number of in-flight requests) and harmless, since the login is idempotent
   * and every caller still receives a valid fresh token.
   */
  async get(opts?: { forceRefresh?: boolean }): Promise<string | undefined> {
    if (this.options.token) return this.options.token;
    if (!this.options.credentials) return undefined;
    if (opts?.forceRefresh) this.pending = undefined;
    if (!this.pending) {
      this.pending = signalkLogin(
        this.options.baseUrl,
        this.options.credentials,
        this.options.fetchImpl,
      ).catch((error: unknown) => {
        // Drop the cached attempt so a later call can retry the login.
        this.pending = undefined;
        throw error;
      });
    }
    return this.pending;
  }
}
