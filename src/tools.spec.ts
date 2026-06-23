import { loadBundledSchema } from './schema/kip-schema.js';
import { callTool, ToolError, VOCAB_TOOL_SPECS } from './tools.js';

const schema = loadBundledSchema();

describe('VOCAB_TOOL_SPECS', () => {
  it('declares the vocabulary tools with zod schemas and read-only hints', () => {
    const names = VOCAB_TOOL_SPECS.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_kip_initial_context',
        'list_kip_widgets',
        'get_widget_schema',
        'get_design_system',
        'get_unit_options',
      ]),
    );
    for (const tool of VOCAB_TOOL_SPECS) {
      expect(typeof tool.inputSchema).toBe('object');
      expect(typeof tool.outputSchema).toBe('object');
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});

describe('callTool', () => {
  it('list_kip_widgets returns the catalog', () => {
    const result = callTool(schema, 'list_kip_widgets') as { widgets: unknown[] };
    expect(result.widgets).toHaveLength(schema.widgets.length);
  });

  it('get_widget_schema returns the requested widget', () => {
    const result = callTool(schema, 'get_widget_schema', { selector: 'widget-numeric' }) as {
      widget: { selector: string };
    };
    expect(result.widget.selector).toBe('widget-numeric');
  });

  it('get_widget_schema throws ToolError for an unknown selector', () => {
    expect(() => callTool(schema, 'get_widget_schema', { selector: 'widget-nope' })).toThrow(ToolError);
  });

  it('get_unit_options finds the group for a known unit', () => {
    const result = callTool(schema, 'get_unit_options', { skUnit: 'rad' }) as {
      found: boolean;
      group: string;
    };
    expect(result.found).toBe(true);
    expect(result.group).toBe('Angle');
  });

  it('get_unit_options reports not found for an unknown unit', () => {
    const result = callTool(schema, 'get_unit_options', { skUnit: 'xyz' }) as { found: boolean };
    expect(result.found).toBe(false);
  });

  it('get_kip_initial_context includes an overview and the widget count', () => {
    const result = callTool(schema, 'get_kip_initial_context') as {
      overview: string;
      widgetCount: number;
    };
    expect(result.overview.length).toBeGreaterThan(50);
    expect(result.widgetCount).toBe(schema.widgets.length);
  });

  it('throws ToolError for an unknown tool', () => {
    expect(() => callTool(schema, 'nope')).toThrow(ToolError);
  });
});
