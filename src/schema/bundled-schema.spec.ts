import { z } from 'zod';
import { loadBundledSchema } from './kip-schema.js';

// A structural gate over the bundled schema snapshot. If a refresh (npm run
// schema:refresh) ever produces a schema that no longer matches what the tools
// rely on, this fails in CI instead of breaking silently at runtime.

const widget = z.object({
  name: z.string(),
  selector: z.string().min(1),
  category: z.enum(['Core', 'Gauge', 'Component', 'Racing']),
  bindingKind: z.enum(['paths-record', 'paths-array', 'datachart', 'none']),
  defaultConfig: z.record(z.string(), z.unknown()),
  pathSlots: z.array(z.object({ slot: z.string() })),
});

const schemaShape = z.object({
  meta: z.object({
    schemaVersion: z.number(),
    kipVersion: z.string().min(1),
    configFileVersion: z.number(),
    configVersion: z.number(),
  }),
  widgets: z.array(widget).min(30),
  designSystem: z.object({
    grid: z.object({
      column: z.literal(24),
      row: z.number(),
      margin: z.number(),
      float: z.boolean(),
      cellHeight: z.string(),
    }),
    colors: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
    themeNames: z.array(z.string()),
    icons: z.array(z.string()),
    unitGroups: z
      .array(
        z.object({
          group: z.string(),
          measures: z.array(z.object({ measure: z.string(), description: z.string() })),
        }),
      )
      .min(1),
  }),
});

describe('bundled schema snapshot', () => {
  it('matches the shape the tools rely on', () => {
    const result = schemaShape.safeParse(loadBundledSchema());
    if (!result.success) {
      throw new Error(`Bundled schema is out of shape:\n${z.prettifyError(result.error)}`);
    }
  });

  it('targets KIP config version 12 (the write path requires it)', () => {
    expect(loadBundledSchema().meta.configVersion).toBe(12);
  });

  it('has unique widget selectors', () => {
    const selectors = loadBundledSchema().widgets.map((w) => w.selector);
    expect(new Set(selectors).size).toBe(selectors.length);
  });
});
