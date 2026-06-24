import { paginate } from './pagination.js';

const items = Array.from({ length: 250 }, (_, i) => `p${i}`);

describe('paginate', () => {
  it('returns everything when neither limit nor cursor is given', () => {
    const page = paginate(items, {});
    expect(page.items).toHaveLength(250);
    expect(page.nextCursor).toBeUndefined();
  });

  it('returns a first page and a nextCursor when limit is given', () => {
    const page = paginate(items, { limit: 100 });
    expect(page.items).toEqual(items.slice(0, 100));
    expect(page.nextCursor).toBeDefined();
  });

  it('does not set nextCursor when the limit covers the rest', () => {
    expect(paginate(items, { limit: 1000 }).nextCursor).toBeUndefined();
    expect(paginate(['a', 'b'], { limit: 2 }).nextCursor).toBeUndefined();
  });

  it('walks every item across pages with no gaps or overlaps', () => {
    const collected: string[] = [];
    let cursor: string | undefined;
    let guard = 0;
    do {
      const page = paginate(items, { limit: 60, cursor });
      collected.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor && ++guard < 100);
    expect(collected).toEqual(items);
  });

  it('defaults the page size when a cursor is given without a limit', () => {
    const first = paginate(items, { limit: 100 });
    const second = paginate(items, { cursor: first.nextCursor });
    expect(second.items).toHaveLength(100); // default page size
    expect(second.items[0]).toBe('p100');
  });

  it('treats a cursor at the exact end as a valid empty page', () => {
    const endCursor = Buffer.from(`o:${items.length}`, 'utf8').toString('base64url');
    const page = paginate(items, { cursor: endCursor });
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeUndefined();
  });

  it('throws on a malformed cursor', () => {
    expect(() => paginate(items, { cursor: 'not-a-real-cursor!!' })).toThrow(/cursor/i);
  });

  it('throws on a cursor pointing past the end', () => {
    // base64url of "o:9999"
    const farCursor = Buffer.from('o:9999', 'utf8').toString('base64url');
    expect(() => paginate(items, { cursor: farCursor })).toThrow(/cursor/i);
  });
});
