# KIP and marine conventions

Domain knowledge for grounding a KIP UX review in real widgets, real Signal K
paths, and established marine-instrument convention. Use it to make findings
specific and to recommend correct labels, units, precision, and colors.

## Contents

- 1. Widget catalog and selection
- 2. Marine abbreviations (recommended labels)
- 3. Unit conventions
- 4. Number precision by quantity
- 5. Color and Signal K zones
- 6. Night vision and themes
- 7. Copy and labeling (PACE, the 4 Simplification Changes, alarm anatomy)
- 8. Config-field cheat sheet (verify against live export)
- 9. Common anti-patterns (quick scan)

---

## 1. Widget catalog and selection

Pick the widget by the *shape* of the data, not by habit. Inconsistent widget
choice for like data is a Pass C finding; the wrong widget for the data shape is
a Pass A/B finding.

- **Numeric** — one scalar with a large value label. Default for an unbounded
  number you simply need to read: SOG, depth, wind speed, VMG, voltage, temp.
- **Text** — textual or enumerated data: MPPT/charge state, next-waypoint name,
  radio track, status strings, formatted date/time.
- **Compact Linear** — horizontal linear gauge with a prominent value label.
  Bounded quantity where you want the number *and* a sense of position.
- **Linear gauge** — bar-style level for a bounded range with a natural
  min/max: tank levels, where "how full" reads better as a bar.
- **Radial gauge** — round dial for a bounded range, especially with zones:
  battery SOC, engine temp, anything where a sweep + color band aids glance.
- **Compass** — heading or bearing on a rotating rose: HDG, COG, wind direction
  as a cardinal.
- **Wind Steering** — the dedicated sailing wind dial (apparent/true angle,
  laylines, close-hauled sectors). Use this for sailing wind, not a generic
  gauge — it carries convention a sailor expects.
- **Data Chart (Historical)** — time-series trend up to the last full day,
  selectable scales including "Days," vertical orientation and inverted scales.
  Use for trends and rates of change, not instantaneous values.
- **Zones State Panel** — monitors many paths at once with color-coded zone
  severity and a status message. Ideal for a systems/at-a-glance fault view —
  spot warnings without opening the notification menu.
- **Boolean Control / Button & Switch** — toggles a Signal K boolean PUT
  device: lights, bilge pump, solenoids. Needs confirmed-state feedback and a
  large hit target (Pass B/F).
- **Date** — timezone-aware date/time.
- **Position** — latitude/longitude.
- **Race Timer / signalk-racer widgets** — start-line analysis and countdown
  for racing dashboards.
- **Embedded Webpage** — iframes external content: Grafana, Node-RED, weather,
  a marina webcam, Freeboard-SK, any web app. Powerful, but **does not inherit
  KIP's night theme** — a night-vision and legibility risk (Pass E).
- **Autopilot** — autopilot status/control.
- **Freeboard-SK** — the Signal K chart plotter (routes, waypoints, charts,
  AIS), embeddable.

Quick selection map: unbounded scalar → Numeric · bounded range with zones →
Radial or Linear · level/fill → Linear · heading/bearing → Compass · sailing
wind → Wind Steering · trend over time → Data Chart · many states at once →
Zones State Panel · on/off control → Boolean · text/enum → Text · external
content → Embedded Webpage.

---

## 2. Marine abbreviations (recommended labels)

Use the short, conventional form as the widget `displayName`. These are what a
sailor reads without thinking (Jakob's Law). Recommend these over spelled-out
phrases.

**Motion / navigation:** SOG (speed over ground) · STW or BSP (speed through
water / boat speed) · COG (course over ground) · HDG, HDT, HDM (heading, true,
magnetic) · POS (position) · VMG (velocity made good) · DTW (distance to
waypoint) · BTW (bearing to waypoint) · XTE (cross-track error) · ETA · TTG
(time to go) · DTG (distance to go).

**Wind:** AWA (apparent wind angle) · AWS (apparent wind speed) · TWA (true wind
angle) · TWS (true wind speed) · TWD (true wind direction) · AWD · GWS/GWD
(ground wind).

**Depth / water:** DPT or DBT (depth below transducer) · DBS (below surface) ·
DBK (below keel) · SST or water temp.

**Electrical:** SOC (state of charge, %) · V (volts) · A (amps) · Ah · W (watts)
· SOLAR.

**Engine:** RPM · oil temp / oil press · coolant · fuel rate.

**Tanks:** FUEL · WATER (fresh) · WASTE or BLACK · GREY · level %.

**Environment:** BARO (pressure) · AIR (air temp) · HUM (humidity).

---

## 3. Unit conventions

Signal K's base units are SI (speed m/s, temperature Kelvin, angles radians,
pressure Pascals, depth meters). KIP converts to display units via
`convertUnitTo`, so the **path is in SI but the displayed unit is a config
choice** — always check `convertUnitTo`, not the path, to judge units.

- **Speed:** knots (kn) for vessel and wind speed. `convertUnitTo: "knots"`.
- **Bearing / heading / course:** degrees, true (°T) or magnetic (°M) — be
  explicit and consistent across the dashboard.
- **Wind angle:** degrees, usually relative to the bow (0–180 port/starboard).
- **Depth:** meters (m) or feet (ft) — pick one for the whole dashboard.
- **Temperature:** °F or °C — pick one. (Fridge, sea, air, engine all the same
  scale.)
- **Electrical:** V, A, Ah, %, W as appropriate.
- **Distance:** nautical miles (nm) for navigation; ft or m for short ranges.
- **Pressure:** hPa/mb or inHg.

Mixing units within a quantity type (one depth in m, another in ft) is a Pass C
**[SHOULD FIX]** finding on decision-relevant data.

---

## 4. Number precision by quantity

Recommended display decimals. Set via KIP's per-widget decimal field (commonly
`numDecimal` — verify the exact key against the export). Inconsistent precision
on the *same* quantity type is a Pass C finding.

- **Depth:** 1 decimal — `12.3`
- **SOG / STW:** 1 decimal — `6.4`
- **Wind speed:** 1 decimal (0 acceptable on a gusty overview) — `14.2`
- **Wind angle:** 0 decimals — `042`
- **Heading / COG / bearing:** 0 decimals — `127`
- **VMG:** 1 decimal (2 sometimes for racing) — `5.1`
- **Battery voltage:** 1–2 decimals — `12.7` or `12.74`
- **Current (A):** 1 decimal — `8.3`
- **State of charge (%):** 0 decimals — `87`
- **Temperature:** 0–1 decimals — `38` or `3.5`
- **Tank level (%):** 0 decimals — `64`
- **Distance (nm):** 1–2 decimals
- **Position:** standard lat/lon (degrees + decimal minutes)

Over-precision (a battery at `87.3294%`) is a Pass D copy finding — it implies
false accuracy and slows the glance.

---

## 5. Color and Signal K zones

KIP reads **Signal K metadata "zones"** — per-path ranges each tagged with a
state (typically nominal/normal, warn/alert, alarm/emergency) — and maps zone
state to a color severity on gauges and the Zones State Panel. Gauges react
dynamically as values cross zone boundaries.

- **Severity convention:** green = normal/safe · amber/yellow = caution/warn ·
  red = alarm/danger. A zone color means the same thing on every widget; never
  repurpose alarm red for decoration (Pass C).
- **Port / starboard:** red = port, green = starboard. Avoid using red/green for
  unrelated states in a way that collides with this.
- **Zone overrides:** widgets can ignore zones (a `ignoreZones`-style flag). Use
  sparingly and intentionally; silently ignoring zones on safety data is a
  finding.
- **Out-of-scale behavior:** if a value exceeds a gauge's `displayScale`, the
  gauge should still signal the exceedance rather than clipping silently.
- KIP ships a set of high-contrast colors for at-a-glance legibility; prefer
  them over low-contrast custom colors.

---

## 6. Night vision and themes

- **Red night mode** preserves dark adaptation and is essential on a dashboard
  used after dark. It can switch automatically by sunrise/sunset (Signal K
  Derived Data plugin) or manually via the moon/sun toggle.
- **Deep-black and true-white themes** exist for direct-sunlight contrast; match
  the theme to the device's environment (bright cockpit vs. dim cabin).
- **Embedded webpages do not inherit KIP's theme.** A light-background Grafana,
  webcam, or weather page will blow night vision and clash with every other
  widget. Flag bright embeds on after-dark dashboards (Pass E); prefer
  dark-themed embeds or hiding them at night.
- **Per-widget bright custom colors** can break night mode; KIP has shipped
  night-mode theming corrections, so custom colors that fight the red theme are
  a finding.
- **Don't rely on hue alone** for critical state — red/green is degraded at
  night and for color-deficient users; a critical state should also differ in
  size, position, or text.

---

## 7. Copy and labeling

Grounded in established UX-writing frameworks — PACE, the Four Simplification
Changes, and clear-writing guidance — adapted for marine instruments.

**The marine-label reconciliation — read first.** Standard marine abbreviations
(Section 2) are the *expected vocabulary* for this audience, not jargon; Jakob's
Law and Mental Model override the generic "use plain words, avoid abbreviations,
design for localization" guidance *for instrument labels*. A helm gauge is not a
localization-sensitive consumer surface. The plain-language, no-idiom,
lead-with-the-why, and localization guidance below applies in full to KIP's
*prose* surfaces — alarm and notification bodies, no-data / empty states, help
and onboarding, embedded-content context — but **not** to the terse labels.

**PACE, for a dashboard:**
- **Purpose** — one job per dashboard (Step 1); highest-impact datum first and
  largest; nothing on the page that belongs on a different dashboard.
- **Anticipation** — answer "what next?": an alarm tells the user what to *do*,
  not merely that something is wrong.
- **Context** — the reader is underway with minimal attention; a notification is
  an interruption, so make it worth firing; a no-data state says what is missing
  and, if knowable, why.
- **Empathy** — plain, inclusive prose on prose surfaces; the standard
  abbreviation is the *empathetic* label choice because it is what the sailor
  already reads without thinking.

**The Four Simplification Changes, applied:**
1. **Remove filler.** No "simply / just / easily" in help or onboarding; no
   interjections ("Oops," "Uh oh") or insincere pleasantries ("Sorry") in
   alarms. Name the condition.
2. **Avoid repetition.** Don't repeat a group label on every widget ("Apparent"
   not "Apparent Wind Speed" inside a Wind cluster); don't restate the title in
   the alarm body.
3. **Lead with the why / the value.** Front-load the actionable fact: "LOW DEPTH
   4.1 ft" before any explanation; "TANK SENSOR OFFLINE" before "check
   connection."
4. **One word per concept (word list).** Section 2's abbreviations are the
   canonical word list — one term per quantity, identical on every dashboard and
   profile. "SOG" everywhere, never "Speed" here and "SOG" there.

**Labels:**
- Always set `displayName`; never ship a raw Signal K path
  (`environment.wind.angleApparent`) — that is the marine equivalent of showing
  an error code to the user.
- Shortest unambiguous form, from Section 2.
- Units appear once — in the label *or* rendered by the gauge, never both.
- One casing convention held everywhere (upper-case abbreviations suit
  instruments).
- Numbers: correct precision (Section 4), correct rounding, signed conventions
  where they aid reading (XTE L/R, VMG +/-); no false precision (`87%`, not
  `87.3294%`).

**Filler & vague-status watchlist** — scan every status, alarm, and help string:
- *Adverbs/adjectives to cut:* simply, just, easily, quickly, seamlessly,
  automatically (unless a real feature), great, powerful, amazing.
- *Interjections to cut:* Oops, Uh oh, Oh no, Yikes.
- *Pleasantries to challenge:* Sorry, We're sorry, Please, Kindly.
- *Vague starters to rewrite:* "Something went wrong," "An error occurred," "No
  data," "Sensor problem" → replace with the named condition + value.

**KIP alarm / notification anatomy:**
- **Title = the condition, named, with the value.** "LOW DEPTH 4.1 ft" — not
  "Depth Warning," not "Are you sure?"
- **Body (if any) = consequence or required action, stated once.** "Shoaling —
  verify position." No repetition of the title, no raw path.
- **No error codes, no raw paths, no interjections, no insincere apology.**
- **If the user must act, say what to do** — actionable beats descriptive.
- **Reserve `!` and color escalation for genuine alarms** so they still carry
  weight when they fire (Von Restorff / Selective Attention).

**When to fire a notification at all** (Situational Rules — Notifications): surface
it only if it is *needed now*, *saves the user hunting through menus*, and
*conveys something new*, and make it **self-contained** — readable without
opening another screen. An alarm the user cannot act on right now is noise.

**No-data / offline states** (Situational Rules — Empty States): a widget with no
value should say *what is missing* and, if knowable, *why or how to fix it* —
"TANK — no data (sensor offline)" — not a blank tile or a stale-looking last
value. This is the empty-state rule applied to a dropped sensor; it pairs with
the Pass F staleness check.

### Voice & tone for a helm display

Of the four core qualities — Clarity,
Simplicity, Friendliness, Helpfulness — a marine instrument leans almost
entirely on **Clarity, Simplicity, and Helpfulness**, with **Friendliness near
zero**: a gauge is not a place for warmth or personality. Dial per situation:

| Situation | Dial toward | Dial away from | Why |
|-----------|-------------|----------------|-----|
| Instrument label | Simplicity + Clarity | everything else | Sub-second glance; use the standard abbreviation |
| Alarm / out-of-range | Clarity + Helpfulness | Friendliness | The user needs action, not comfort |
| No-data / offline | Helpfulness | — | Say what's missing and how to fix it |
| Help / onboarding | Helpfulness + Clarity | Simplicity | Teach briefly; lead with the why |
| Confirm a control (bilge pump, etc.) | Clarity | all else | Precision prevents a costly mistake |

### Label word list (Use / Avoid)

The fourth Simplification Change is "Make a Word List." Section 2 is the
canonical list; these are the highest-value Use/Avoid pairs to enforce one term
per concept across every dashboard and profile:

| Use | Avoid | Concept |
|-----|-------|---------|
| SOG | Speed, SPD, Ground Speed | Speed over ground |
| STW | BSP, Boat Speed, Water Speed | Speed through water |
| COG | Course, CRS, Track | Course over ground |
| HDG | Heading, Compass | Heading (mark true vs. magnetic) |
| DPT | Depth, DBT, Sounder | Depth below transducer |
| AWA / AWS | App Wind, Appt Wind | Apparent wind angle / speed |
| TWS / TWD | True Wind, TW Spd/Dir | True wind speed / direction |
| SOC | Battery %, Charge, Batt | State of charge |
| FUEL / WATER / WASTE | Tank 1/2/3, Diesel, Black | Tank contents |

Source frameworks: PACE · the Four Simplification Changes · Voice & Tone —
adapted for marine instruments.

---

## 8. Config-field cheat sheet (verify against live export)

Fields a review names when recommending a fix. **KIP's exact key names vary by
version; the live config export is the authoritative schema.** Phrase fixes so
the user verifies the key, e.g. "set the decimal field (commonly `numDecimal`)".

- **Identity:** widget `type`, `uuid`/`id`.
- **Layout / footprint:** grid position and size — `x`, `y`, `w`, `h` (the
  layout engine's coordinates). Footprint changes drive real-estate fixes.
- **Per-path config:** `path`, `source`, `sampleTime`, `convertUnitTo`
  (display unit). Source/path drive duplicate-source and unit findings.
- **Display:** `displayName` (label), decimal field (commonly `numDecimal`),
  `displayScale` (gauge `lower`/`upper`/`type`).
- **Zones / color:** zone usage via Signal K metadata; zone-override /
  `ignoreZones` flag; per-widget `color`/accent and theme inheritance.

When a fix would change layout, prefer concrete footprint guidance ("give depth
the central cell, roughly `w`×`h` of the current clock widget") over vague
"make it bigger."

---

## 9. Common anti-patterns (quick scan)

A lookup for the recurring KIP dashboard sins. Each maps to a pass and a
principle; use it to spot findings fast, not as a substitute for the passes.

| Anti-pattern | Why it's a problem | Fix | Principle |
|---|---|---|---|
| Raw Signal K path as a label | Reads like an error code; unparseable at a glance | Set `displayName` to the standard abbreviation | 4 Changes — no error codes |
| Mixed units for one quantity (depth in m and ft) | Forces mental conversion underway | Standardize `convertUnitTo` across like widgets | Jakob's Law |
| Inconsistent precision (`12` vs `12.3`) | Looks like two different sources | Fix the decimal field per quantity type | Law of Similarity |
| Clock or decorative tile in prime real estate | Steals the best spot from high-impact data | Demote it; promote depth/wind/heading | Pareto |
| Critical state by color alone | Invisible at night and to color-deficient users | Add size, shape, position, or text | Differentiate without color |
| Everything "pops" (many bright tiles/alarms) | Alarm fatigue; the real signal is lost | Reserve emphasis for true exceptions | Selective Attention / Von Restorff |
| Related instruments split across pages | Swiping defeats grouping | Cluster them on one page | Law of Proximity |
| Fancy gauge for safety data | Form over legibility | Use the clearest widget at the biggest tier | Law of Prägnanz |
| Un-themed embed (light webcam/Grafana) at night | Destroys night vision | Dark-theme it or hide after dark | Night-vision |
| Undersized touch control | Missed taps with wet/gloved hands | ≥44pt, larger for underway controls | Fitts's Law |
| Frozen value, no staleness cue | Looks live when the sensor is dead | Enable timeout/stale styling | Postel's Law |
| Two sources for one quantity (e.g. two water temps) | Ambiguity about which is right | Pick one source/path or label distinctly | Consistency |
| Vague status text ("Something went wrong") | Not actionable | Name the condition + value + what to do | Situational — Errors |
| 12+ equal tiles on one page | Exceeds working memory; all shrink below legibility | Chunk into 3–4 groups; fewer, larger widgets | Miller's Law |
