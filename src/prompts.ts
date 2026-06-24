/**
 * Guided prompts: one-click workflows a user can pick in their AI client, so
 * they don't have to know which tools to call in which order. Each prompt
 * returns a single user message that tells the assistant how to proceed.
 */
import { z } from 'zod';
import { optionalCompletable, prefixComplete } from './completion.js';

/** Common areas a user might want a dashboard set to emphasise. */
const FOCUS_AREAS = [
  'sailing',
  'navigation',
  'power',
  'environment',
  'anchoring',
  'engine',
  'racing',
  'weather',
];

interface PromptMessage {
  role: 'user';
  content: { type: 'text'; text: string };
}

export interface PromptResult {
  messages: PromptMessage[];
  // The SDK's GetPromptResult carries an index signature (for _meta etc.).
  [key: string]: unknown;
}

export interface PromptSpec {
  name: string;
  title: string;
  description: string;
  argsSchema: z.ZodRawShape;
  build: (args: Record<string, string | undefined>) => PromptResult;
}

function userMessage(lines: string[]): PromptResult {
  return {
    messages: [{ role: 'user', content: { type: 'text', text: lines.filter(Boolean).join('\n') } }],
  };
}

/** The UX-review skill's actions (see the kip://ux-review-guide resource). */
const UX_ACTIONS = ['review', 'copy', 'principles', 'brief'];

const UX_PREAMBLE =
  'You are an expert marine-instrument UX reviewer for KIP (Signal K) dashboards. ' +
  'Read these resources first: `kip://ux-review-guide` (the method, six passes, severity ' +
  'rubric, and output format), `kip://ux-laws` (the Laws of UX for marine displays), and ' +
  '`kip://ux-conventions` (widget catalog, marine abbreviations, units, precision, ' +
  'colour/zones, copy style, and anti-patterns).';

function uxReviewMessage(action: string | undefined): PromptResult {
  switch ((action ?? 'review').toLowerCase()) {
    case 'principles':
      return userMessage([
        UX_PREAMBLE,
        'Action: principles. Present the codified pattern reference — summarise `kip://ux-laws` ' +
          'and the relevant parts of `kip://ux-conventions`. No dashboard config is needed.',
      ]);
    case 'brief':
      return userMessage([
        UX_PREAMBLE,
        'Action: brief. Ask me for the use case and device (e.g. "underway helm on a 10-inch ' +
          'chartplotter"), then propose a dashboard layout from scratch per the guide\'s `brief` ' +
          'action: establish the job first, then lay out impact-weighted, grouped widgets with ' +
          'recommended types, labels, units, precision, and zones.',
      ]);
    case 'copy':
      return userMessage([
        UX_PREAMBLE,
        'Action: copy. I will paste my KIP dashboard config JSON. Do a focused pass on labels, ' +
          'units, precision, and alarm/notification text only (Pass D plus §7 of ' +
          '`kip://ux-conventions`). Output the copy findings with Before → After and the filler scan.',
      ]);
    default:
      return userMessage([
        UX_PREAMBLE,
        'Action: review. I will paste my KIP dashboard config JSON (and, if I can, a screenshot). Steps:',
        '1. Run `check_dashboard_ux` on the config for the objective findings (mixed units, ' +
          'inconsistent precision, raw-path labels, duplicate paths, overlapping cells), and ' +
          '`validate_kip_config` for structural problems.',
        '2. Run the six-pass review from `kip://ux-review-guide`, grounding each finding in the ' +
          'config or the screenshot.',
        "3. Emit the severity-tagged checklist exactly in the guide's output format, then offer a " +
          'patched config.',
      ]);
  }
}

export const PROMPT_SPECS: PromptSpec[] = [
  {
    name: 'design_dashboards',
    title: 'Design KIP dashboards for my boat',
    description:
      "Guided workflow: look at the boat's data, recommend dashboards, preview them, and install them with your OK.",
    argsSchema: {
      focus: optionalCompletable(
        'Optional area to emphasise, e.g. "sailing", "engine" or "anchoring".',
        prefixComplete(FOCUS_AREAS),
      ),
    },
    build: ({ focus }) =>
      userMessage([
        'Help me design KIP dashboards for my boat. Please work through these steps:',
        '1. Call `analyze_signalk_data` to see what data my boat reports.',
        '2. Call `recommend_dashboard_set` to propose dashboards the data supports.',
        '3. Show me the ASCII preview of each one and explain, in plain language, what it shows and what was left out.',
        '4. When I say go ahead, call `apply_kip_config` — it dry-runs first and asks before writing.',
        focus ? `Focus especially on: ${focus}.` : '',
      ]),
  },
  {
    name: 'review_dashboard',
    title: 'Review a KIP dashboard',
    description:
      'Critique a KIP dashboard for marine UX — visual hierarchy, grouping, consistency, and copy — with severity-tagged findings and fixes. Actions: review (default), copy, principles, brief.',
    argsSchema: {
      action: optionalCompletable(
        'What to do: review (default), copy, principles, or brief.',
        prefixComplete(UX_ACTIONS),
      ),
    },
    build: ({ action }) => uxReviewMessage(action),
  },
];
