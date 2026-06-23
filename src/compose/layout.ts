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
 * STUB: implemented in the GREEN step.
 */
export function shelfPack(_widgets: SizedWidget[], _columns = 24): PlacedWidget[] {
  return [];
}
