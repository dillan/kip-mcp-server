import { shelfPack, type PlacedWidget } from './layout.js';

function overlaps(a: PlacedWidget, b: PlacedWidget): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('shelfPack', () => {
  it('packs left to right and wraps to a new shelf on overflow', () => {
    const placed = shelfPack([
      { selector: 'a', w: 12, h: 6 },
      { selector: 'b', w: 12, h: 6 },
      { selector: 'c', w: 24, h: 8 },
    ]);
    expect(placed.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 0, y: 6 },
    ]);
  });

  it('never overlaps and stays within the column count', () => {
    const widgets = Array.from({ length: 10 }, (_, i) => ({ selector: `w${i}`, w: 6, h: 4 }));
    const placed = shelfPack(widgets, 24);
    for (const p of placed) {
      expect(p.x + p.w).toBeLessThanOrEqual(24);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlaps(placed[i], placed[j])).toBe(false);
      }
    }
  });

  it('clamps widths larger than the grid', () => {
    const placed = shelfPack([{ selector: 'big', w: 30, h: 4 }], 24);
    expect(placed[0].w).toBe(24);
    expect(placed[0].x).toBe(0);
  });
});
