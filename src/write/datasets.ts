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

export function deriveDataSets(dashboards: unknown[]): DataSetEntry[] {
  const out: DataSetEntry[] = [];
  for (const dashboard of dashboards) {
    const config = (dashboard ?? {}) as { configuration?: unknown };
    const nodes = Array.isArray(config.configuration) ? config.configuration : [];
    for (const raw of nodes) {
      if (!raw || typeof raw !== 'object') continue;
      const node = raw as {
        id?: unknown;
        input?: { widgetProperties?: { type?: unknown; config?: unknown } };
      };
      const wp = node.input?.widgetProperties;
      if (wp?.type !== 'widget-data-chart') continue;
      const cfg = (wp.config ?? {}) as Record<string, unknown>;
      const path = typeof cfg.datachartPath === 'string' ? cfg.datachartPath : '';
      if (!path) continue;
      const rawSource = typeof cfg.datachartSource === 'string' ? cfg.datachartSource : '';
      const convertUnitTo = typeof cfg.convertUnitTo === 'string' ? cfg.convertUnitTo : '';
      const timeScale = typeof cfg.timeScale === 'string' ? cfg.timeScale : 'minute';
      const period = typeof cfg.period === 'number' ? cfg.period : 10;
      out.push({
        uuid: typeof node.id === 'string' ? node.id : '',
        path,
        pathSource: rawSource || 'default',
        baseUnit: '',
        timeScaleFormat: timeScale,
        period,
        // The label KIP matches on: path | convertUnitTo | source | timeScale | period.
        label: [path, convertUnitTo, rawSource, timeScale, String(period)].join('|'),
        editable: false,
      });
    }
  }
  return out;
}
