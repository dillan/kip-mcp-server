export interface SizedWidget {
  selector: string;
  w: number;
  h: number;
  /** Optional grouping key; members of a group stay adjacent. */
  group?: string;
}

export interface PlacedWidget extends SizedWidget {
  x: number;
  y: number;
}

/**
 * Packs widgets into a fixed-column grid using deterministic shelf (row) packing:
 * place left-to-right, wrap to a new shelf when a widget would overflow the row.
 * Widths are clamped to [1, columns].
 *
 */
export function shelfPack(widgets: SizedWidget[], columns = 24): PlacedWidget[] {
  const placed: PlacedWidget[] = [];
  let x = 0;
  let shelfY = 0;
  let shelfH = 0;

  for (const widget of widgets) {
    const w = Math.min(Math.max(Math.round(widget.w), 1), columns);
    if (x + w > columns) {
      shelfY += shelfH;
      x = 0;
      shelfH = 0;
    }
    placed.push({ ...widget, w, x, y: shelfY });
    x += w;
    shelfH = Math.max(shelfH, widget.h);
  }

  return placed;
}
