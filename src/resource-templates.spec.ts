import {
  completeTemplateId,
  completeWidgetSelector,
  listTemplateResources,
  listWidgetResources,
  readTemplateResource,
  readWidgetResource,
} from './resource-templates.js';
import { loadBundledSchema } from './schema/kip-schema.js';

const schema = loadBundledSchema();

describe('widget resources', () => {
  it('lists every widget as a kip://widget/{selector} resource', () => {
    const list = listWidgetResources(schema);
    expect(list).toHaveLength(schema.widgets.length);
    expect(list.every((r) => r.uri.startsWith('kip://widget/'))).toBe(true);
    expect(list.every((r) => r.mimeType === 'application/json')).toBe(true);
  });

  it('completes selectors by case-insensitive prefix', () => {
    const out = completeWidgetSelector(schema, 'widget-gauge');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((s) => s.startsWith('widget-gauge'))).toBe(true);
    expect(completeWidgetSelector(schema, 'WIDGET-NUM')).toContain('widget-numeric');
  });

  it('reads one widget and throws on an unknown selector', () => {
    expect(JSON.parse(readWidgetResource(schema, 'widget-numeric')).selector).toBe(
      'widget-numeric',
    );
    expect(() => readWidgetResource(schema, 'nope')).toThrow(/Unknown widget/);
  });
});

describe('template resources', () => {
  it('lists every dashboard template as a kip://template/{id} resource', () => {
    const list = listTemplateResources();
    expect(list.length).toBeGreaterThanOrEqual(5);
    expect(list.map((r) => r.uri)).toContain('kip://template/sailing');
  });

  it('completes template ids by prefix', () => {
    expect(completeTemplateId('nav')).toContain('navigation');
    expect(completeTemplateId('')).toEqual(expect.arrayContaining(['general', 'sailing']));
  });

  it('reads one template and throws on an unknown id', () => {
    expect(JSON.parse(readTemplateResource('sailing')).id).toBe('sailing');
    expect(() => readTemplateResource('nope')).toThrow(/Unknown template/);
  });
});
