/**
 * Opt-in cursor pagination for the discovery tools.
 *
 * On a large vessel `analyze_signalk_data` / `list_available_paths` can return
 * hundreds of paths in one response. A client can page by passing `limit` (and
 * then the returned `nextCursor`). Passing neither returns everything, so older
 * clients keep working unchanged.
 *
 * The cursor is an opaque base64url token; it encodes a simple offset, but
 * callers must treat it as opaque and only ever echo back a value the server
 * handed them.
 */

const DEFAULT_PAGE_SIZE = 100;

export interface PageOptions {
  /** Maximum items to return. When omitted (and no cursor), all items are returned. */
  limit?: number;
  /** An opaque token from a previous page's `nextCursor`. */
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  /** Present only when more items remain; pass it back as `cursor` for the next page. */
  nextCursor?: string;
}

function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): number {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const match = /^o:(\d+)$/.exec(decoded);
  if (!match) {
    throw new Error('Invalid pagination cursor.');
  }
  return Number(match[1]);
}

/**
 * Returns a page of `all`. With no `limit` and no `cursor`, returns everything
 * (no paging). Otherwise slices `[offset, offset + pageSize)` and sets
 * `nextCursor` when more items remain. Throws on a cursor that does not point
 * inside `all`.
 */
export function paginate<T>(all: readonly T[], opts: PageOptions): Page<T> {
  if (opts.limit === undefined && opts.cursor === undefined) {
    return { items: [...all] };
  }
  const pageSize = opts.limit ?? DEFAULT_PAGE_SIZE;
  const offset = opts.cursor === undefined ? 0 : decodeCursor(opts.cursor);
  // decodeCursor only yields non-negative offsets, so just guard the upper bound.
  if (offset > all.length) {
    throw new Error('Invalid pagination cursor.');
  }
  const end = offset + pageSize;
  const items = all.slice(offset, end);
  return end < all.length ? { items, nextCursor: encodeCursor(end) } : { items };
}
