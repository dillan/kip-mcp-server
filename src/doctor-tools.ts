/**
 * MCP tool for connection diagnostics. Wraps runDoctor (src/doctor.ts), which is
 * also used by the `--doctor` CLI flag.
 */
import { z } from 'zod';
import { runDoctor, type DoctorDeps } from './doctor.js';
import { READ_ONLY_REMOTE, type ToolSpec } from './tool-spec.js';
import { ToolError } from './tools.js';

export const DOCTOR_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'check_connection',
    title: 'Check connection',
    description:
      'Run connection diagnostics against the live Signal K server and KIP install: server reachable, version supports the applicationData write store (>= 1.27), the KIP schema asset is served live, and authentication works when credentials are set. Reports each check as pass, warn or fail with plain-language guidance.',
    inputSchema: {},
    outputSchema: {
      ok: z.boolean(),
      checks: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          severity: z.enum(['pass', 'warn', 'fail', 'skip']),
          detail: z.string(),
          guidance: z.string().optional(),
        }),
      ),
      summary: z.string(),
    },
    annotations: READ_ONLY_REMOTE,
  },
];

export const DOCTOR_TOOL_NAMES: ReadonlySet<string> = new Set(DOCTOR_TOOL_SPECS.map((t) => t.name));

export async function callDoctorTool(deps: DoctorDeps, name: string): Promise<unknown> {
  if (name === 'check_connection') {
    return runDoctor(deps);
  }
  throw new ToolError(`Unknown doctor tool "${name}".`);
}
