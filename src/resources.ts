import { readFileSync } from 'node:fs';
import { resourcePath } from './utils/paths.js';

const cache = new Map<string, string>();

/** Reads a text resource shipped under src/resources (cached; these files are static). */
export function readResourceText(name: string): string {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(resourcePath(name), 'utf8');
    cache.set(name, text);
  }
  return text;
}
