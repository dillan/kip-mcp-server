import { readFileSync } from 'node:fs';
import { resourcePath } from './utils/paths.js';

/** Reads a text resource shipped under src/resources. */
export function readResourceText(name: string): string {
  return readFileSync(resourcePath(name), 'utf8');
}
