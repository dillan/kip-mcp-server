/**
 * Guided prompts: one-click workflows a user can pick in their AI client, so
 * they don't have to know which tools to call in which order. Each prompt
 * returns a single user message that tells the assistant how to proceed.
 */
import { z } from 'zod';

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

export const PROMPT_SPECS: PromptSpec[] = [
  {
    name: 'design_dashboards',
    title: 'Design KIP dashboards for my boat',
    description:
      "Guided workflow: look at the boat's data, recommend dashboards, preview them, and install them with your OK.",
    argsSchema: {
      focus: z
        .string()
        .optional()
        .describe('Optional area to emphasise, e.g. "sailing", "engine" or "anchoring".'),
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
    description: 'Check a dashboard for problems and suggest fixes in plain language.',
    argsSchema: {},
    build: () =>
      userMessage([
        'Please review my KIP dashboard:',
        '1. Call `validate_kip_config` on it.',
        '2. Explain any errors or warnings in plain language.',
        '3. Suggest specific fixes, and offer to apply them.',
      ]),
  },
];
