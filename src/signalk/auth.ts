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
  _baseUrl: string,
  _credentials: Credentials,
  _fetchImpl: typeof fetch = fetch,
): Promise<string> {
  throw new Error('signalkLogin not implemented');
}

/**
 * Resolves the auth token for Signal K requests: a static token when one is set,
 * otherwise a username/password login that runs once and is then reused.
 */
export class TokenProvider {
  constructor(_opts: {
    baseUrl: string;
    token?: string;
    credentials?: Credentials;
    fetchImpl?: typeof fetch;
  }) {}

  /** Returns a token, or undefined when no auth is configured. */
  async get(): Promise<string | undefined> {
    throw new Error('TokenProvider not implemented');
  }
}
