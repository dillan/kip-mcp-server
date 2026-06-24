/**
 * Builds `app.dataSets` entries for the data-chart widgets in a set of dashboards.
 *
 * KIP's data-chart widget creates its own dataset when it loads, and prunes
 * stored entries that don't match a widget (it runs cleanup for configVersion
 * >= 12). So each entry here uses the widget's own uuid and a four-part
 * pathSignature label, which is exactly what KIP expects — the seeded entry
 * survives the prune and the chart has data immediately.
 */

export interface DataSetEntry {
  uuid: string;
  path: string;
  pathSource: string;
  baseUnit: string;
  timeScaleFormat: string;
  period: number;
  label: string;
  editable: boolean;
}

export function deriveDataSets(_dashboards: unknown[]): DataSetEntry[] {
  throw new Error('deriveDataSets not implemented');
}
