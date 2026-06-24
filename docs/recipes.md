# Recipes

Worked examples of asking your AI assistant to design KIP dashboards. You talk to the assistant
in plain language; it calls the tools for you. The tool names below are just so you can see what's
happening under the hood — see the [tool reference](./tools.md) for all of them.

## Design a set of dashboards for your boat

The quickest start is the **`design_dashboards`** prompt (pick it from your assistant's prompt
list), or just say:

> Look at my boat's data and suggest some KIP dashboards.

What happens:

1. The assistant calls **`analyze_signalk_data`** to see what your boat reports (speed, wind,
   depth, batteries, engine, …) and which plugins are installed.
2. It calls **`recommend_dashboard_set`**, which proposes the dashboards your data supports —
   typically a general one plus job-specific ones (sailing, motoring, power, anchoring,
   navigation, weather) — each with a small ASCII preview.
3. It shows you the previews and explains what each dashboard shows and what was left out.
4. When you say go ahead, it calls **`apply_kip_config`**. That asks you to confirm before it
   writes anything; only after you say yes does it save to your boat.

## Build one dashboard for a specific job

> Build me a sailing dashboard.

The assistant calls **`compose_dashboard`** with the `sailing` intent. You get the dashboard, an
ASCII preview, and a note of any widgets it couldn't place (for example, a wind display when the
boat reports no wind). Ask it to tweak and preview again before saving.

## Check a dashboard against your boat before saving

> Will this dashboard work on my boat?

The assistant calls **`validate_against_signalk`**, which checks the dashboard against the live
boat: every data path it uses actually exists, the widgets' required plugins are installed and
enabled, and the units line up. It reports anything missing so you can fix it before saving.

## Save without write access (older servers or no login)

If your Signal K server is older than 1.27, or you'd rather not give the server write access, ask:

> Give me a file I can import instead.

The assistant calls **`export_kip_config`** and hands you a `KipConfig.json`. Open KIP, go to
**Settings**, and import it.

## Confirm everything is connected

Before designing, you can ask:

> Check my connection.

The assistant runs **`check_connection`** (the same checks as the `--doctor` command) and reports
whether the server is reachable, can save dashboards, is serving KIP's schema, and accepts your
login.
