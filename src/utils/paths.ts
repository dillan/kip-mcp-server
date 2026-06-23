import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walks up from this module to find the package root (the dir with package.json). */
export function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('kip-mcp-server: could not locate the package root');
}

/** Absolute path to a file shipped under src/resources. */
export function resourcePath(name: string): string {
  return join(packageRoot(), 'src', 'resources', name);
}
