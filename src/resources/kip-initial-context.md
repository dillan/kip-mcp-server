# Designing KIP dashboards

This server helps you design dashboards for **KIP**, a Signal K marine instrument
panel. A dashboard is a grid of **widgets**; each widget shows one or more Signal K
data **paths** (for example boat speed, wind, or depth).

## The workflow

1. **Analyse the boat's data** — find which Signal K paths and plugins are available.
2. **Recommend dashboards** — propose a general dashboard plus use-case ones
   (navigation, sailing, motoring, power, anchoring, environment).
3. **Preview** — show a picture of each dashboard for a human to approve.
4. **Validate** — check the dashboard is well-formed and its paths exist.
5. **Apply** — only after approval, write it to KIP (or export a file to import).

The data-discovery, compose, validate and apply steps arrive in later versions. This
version provides the **design vocabulary**: the widget catalog and design system.

## Tools in this version

- `list_kip_widgets` — the widget catalog (name, category, sizes, plugin needs,
  binding kind). Filter by category or to widgets that need no plugins.
- `get_widget_schema` — one widget's default config, binding kind and data slots.
- `get_design_system` — the grid (24 columns), colour tokens, theme names, dashboard
  icons and unit groups.
- `get_unit_options` — for a Signal K unit (such as `rad` or `m/s`), the matching unit
  group and the units you can convert it to.

## Binding kinds

How a widget takes data:

- `paths-record` — the common case; bind a Signal K path to each named slot.
- `paths-array` — switch/zones panels; controls are paired with paths (set up by hand).
- `datachart` — a single history-chart path set at the top level of the config.
- `none` — no path binding (static widgets, or ones configured by a special object).

## Good defaults

- Colours are **named tokens** (`contrast`, `blue`, …), not hex values.
- Lay widgets out on a **24-column** grid.
- Convert units to sensible display units (for example wind angle `rad` → `deg`,
  speed `m/s` → `knots`).
