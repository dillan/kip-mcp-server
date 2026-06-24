/**
 * Protected Resource Metadata (RFC 9728) unit tests (RED first; fail on purpose
 * until resource-metadata.ts is implemented).
 *
 * Serving this document at /.well-known/oauth-protected-resource/mcp makes a 401
 * discoverable by compliant clients (Claude.ai / ChatGPT) and advertises the
 * least-privilege `kip:design` scope. We reuse the SDK's
 * getOAuthProtectedResourceMetadataUrl so the advertised URL matches the spec.
 */
import {
  RESOURCE_METADATA_PATH,
  buildProtectedResourceMetadata,
  resourceMetadataPathFor,
  resourceMetadataUrlFor,
} from './resource-metadata.js';

describe('resource metadata', () => {
  const publicUrl = 'https://boat.example.com/mcp';

  it('serves at the spec well-known path', () => {
    expect(RESOURCE_METADATA_PATH).toBe('/.well-known/oauth-protected-resource/mcp');
  });

  it('advertises the resource, header bearer method, and least-privilege scope', () => {
    const meta = buildProtectedResourceMetadata({ publicUrl, scopes: ['kip:design'] });
    expect(meta.resource).toBe(publicUrl);
    expect(meta.scopes_supported).toEqual(['kip:design']);
    expect(meta.bearer_methods_supported).toEqual(['header']);
  });

  it('defaults to the kip:design scope when none is given', () => {
    const meta = buildProtectedResourceMetadata({ publicUrl });
    expect(meta.scopes_supported).toEqual(['kip:design']);
  });

  it('includes authorization_servers only when configured (phase-1 static bearer omits it)', () => {
    const withoutAs = buildProtectedResourceMetadata({ publicUrl });
    expect(withoutAs.authorization_servers).toBeUndefined();

    const withAs = buildProtectedResourceMetadata({
      publicUrl,
      authorizationServers: ['https://auth.example.com'],
    });
    expect(withAs.authorization_servers).toEqual(['https://auth.example.com']);
  });

  it('includes a resource_name only when configured', () => {
    expect(buildProtectedResourceMetadata({ publicUrl }).resource_name).toBeUndefined();
    expect(
      buildProtectedResourceMetadata({ publicUrl, resourceName: 'KIP MCP' }).resource_name,
    ).toBe('KIP MCP');
  });

  it('derives the well-known URL from the server URL per the SDK helper', () => {
    expect(resourceMetadataUrlFor(publicUrl)).toBe(
      'https://boat.example.com/.well-known/oauth-protected-resource/mcp',
    );
  });

  it('derives the local serve path so it matches the advertised URL for a custom endpoint path', () => {
    // The served path must equal the path component of the advertised URL, even
    // when the MCP endpoint is not the default /mcp.
    expect(resourceMetadataPathFor('https://boat.example.com/mcp')).toBe(RESOURCE_METADATA_PATH);
    expect(resourceMetadataPathFor('https://boat.example.com/kip-mcp')).toBe(
      '/.well-known/oauth-protected-resource/kip-mcp',
    );
    expect(new URL(resourceMetadataUrlFor('https://boat.example.com/kip-mcp')).pathname).toBe(
      resourceMetadataPathFor('https://boat.example.com/kip-mcp'),
    );
  });

  it('falls back to the default path when the public URL is unparseable', () => {
    expect(resourceMetadataPathFor('not a url')).toBe(RESOURCE_METADATA_PATH);
  });
});
