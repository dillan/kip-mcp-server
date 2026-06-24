# Laws of UX — codified for KIP marine dashboards

Each entry is a plain-language restatement of the principle (not a quotation of
any source), followed by *KIP:* — how it lands on a marine instrument MFD — and
the review **Pass** it powers. Source catalog: Laws of UX by Jon Yablonski
(lawsofux.com). Definitions here are paraphrased in original wording.

## Contents

- Grouping and structure (Pass A)
- Attention and real estate (Pass B)
- Consistency and familiarity (Pass C)
- Cognitive load and simplicity (Pass E)
- Responsiveness and input tolerance (Pass F)
- Aesthetics and the remembered experience (cross-cutting)

---

## Grouping and structure — Pass A

**Law of Proximity** — Things placed close together are perceived as related.
*KIP:* Adjacent grid cells read as one functional group; gaps read as
separation. Cluster wind widgets together, electrical together, and so on.

**Law of Common Region** — Elements inside a shared, clearly bounded area are
seen as a group, even when far apart.
*KIP:* Each widget's card boundary is a region; deliberate spacing or a labeled
zone of cells can bind a cluster. Use boundaries to make groups obvious without
relying on proximity alone.

**Law of Similarity** — Elements that look alike are perceived as belonging
together or serving the same purpose.
*KIP:* Consistent widget treatment signals "same kind of thing." Don't make a
critical readout look like a decorative one; do make peers look like peers.

**Law of Uniform Connectedness** — Elements that are visually connected are
seen as more related than ones merely close or similar.
*KIP:* Shared headers, alignment, or a common background tie a group more
strongly than proximity. Aligning a cluster's widgets reinforces the grouping.

**Chunking** — Breaking information into meaningful groups makes it easier to
process and recall.
*KIP:* Three or four labeled clusters beat a flat field of equal tiles. A
glanceable dashboard is chunked by task, not dumped as a grid of numbers.

**Law of Prägnanz** — People read ambiguous or complex layouts as the simplest
form available, because simple costs the least effort.
*KIP:* The cleanest, most regular arrangement is the one the eye accepts
fastest. Irregular, busy layouts make the brain work to impose order.

---

## Attention and real estate — Pass B

**Pareto Principle (80/20)** — Most of the value comes from a small fraction of
the elements.
*KIP:* The ~20% of data driving ~80% of decisions for this dashboard's job
earns the largest footprint and prime position. Everything else is secondary.

**Von Restorff Effect (isolation)** — The item that differs from its neighbors
is the one noticed and remembered.
*KIP:* Make alarms and out-of-range states stand out by color and size so they
pop from the field. Reserve "popping" for genuinely exceptional states.

**Selective Attention** — People focus on a goal-relevant subset of what's on
screen and tune out the rest.
*KIP:* If everything competes for attention, the important thing is lost, and
constant alarms breed alarm fatigue. Restraint is what makes the signal visible.

**Serial Position Effect** — The first and last items in a sequence are best
remembered and found.
*KIP:* Place a key datum first in reading order; the strongest end-positions are
prime spots for high-impact values, weak middles for low-impact ones.

**Fitts's Law** — Time to hit a target depends on its size and distance; bigger
and closer is faster and more reliable.
*KIP:* Controls operated underway — Boolean switches, page nav — need large hit
targets. Wet hands, gloves, and a heeling boat make small targets miss. Treat
undersized touch controls as a real defect.

---

## Consistency and familiarity — Pass C

**Jakob's Law** — People spend most of their time with *other* interfaces and
expect yours to behave like the ones they already know.
*KIP:* Match established marine-instrument convention — standard abbreviations,
units, gauge directions, port-red/starboard-green — rather than inventing local
ones. Familiarity is free glanceability.

**Mental Model** — People act on a compressed internal model of how a system
works; friction appears when the interface contradicts it.
*KIP:* A sailor's model says depth shrinking means shoaling, red means danger,
a compass rotates a known way. Honor those expectations; surprises cost
attention the helm can't spare.

**Law of Similarity** (also Pass A) — Similar appearance implies similar
meaning.
*KIP:* Keep one widget treatment per data kind across all pages, one casing
convention for labels, one color meaning for each zone severity.

---

## Cognitive load and simplicity — Pass E

**Cognitive Load** — The mental effort required to understand and operate an
interface; excess load degrades performance.
*KIP:* Underway, spare attention is scarce. Every redundant label, competing
source, or unit the user must mentally convert spends it. Cut load aggressively.

**Miller's Law (7 ± 2)** — Working memory holds only a handful of items at once.
*KIP:* A page crammed with a dozen-plus equal widgets exceeds what the eye can
hold and shrinks everything below readability. Fewer, larger, grouped widgets win.

**Working Memory** — A limited store that briefly holds information while a task
is performed.
*KIP:* Don't force the user to remember a value from one page to compare on
another; put things that are read together in the same place.

**Hick's Law** — Decision time grows with the number and complexity of choices.
*KIP:* Too many pages or controls slows the user finding the right one. Keep the
page count purposeful and navigation obvious.

**Tesler's Law (conservation of complexity)** — Every system has irreducible
complexity; the only question is who absorbs it.
*KIP:* Marine data is genuinely complex. Absorb that complexity in good defaults
(units, zones, sensible widget choices) so the helm view stays simple.

**Occam's Razor** — Prefer the solution with the fewest unnecessary elements.
*KIP:* If a widget, label word, or page doesn't earn its place for this
dashboard's job, remove it.

---

## Responsiveness and input tolerance — Pass F

**Doherty Threshold** — Interaction feels productive when neither user nor
system waits on the other (roughly sub-400ms response).
*KIP:* Live data should update promptly and controls should respond at once;
sluggish telemetry or laggy switches undermine trust at the helm.

**Postel's Law (robustness)** — Be liberal in what you accept, conservative in
what you emit.
*KIP:* Tolerate the messy reality of Signal K inputs — varied units, missing
metadata or zones, multiple sources — and still render sensibly or degrade
gracefully, rather than going blank or showing wrong-unit values.

---

## Aesthetics and the remembered experience — cross-cutting

**Aesthetic-Usability Effect** — People perceive attractive interfaces as more
usable and forgive minor friction in them.
*KIP:* A clean, well-aligned, legible dashboard is trusted and used; a cluttered
one is distrusted even when functional. Polish is not vanity here.

**Peak-End Rule** — An experience is judged largely by its most intense moment
and its end.
*KIP:* The moments that define trust are the high-stakes ones — an alarm firing,
a close-quarters situation. If the dashboard is clear exactly then, the whole
tool is judged reliable.

**Paradox of the Active User** — People start using software immediately without
reading instructions.
*KIP:* The layout must be self-evident. A crew member should read the screen
correctly with no training, which means leaning on convention (Jakob's Law).
