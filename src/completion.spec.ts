import { isCompletable } from '@modelcontextprotocol/sdk/server/completable.js';
import type { z } from 'zod';
import { optionalCompletable, prefixComplete } from './completion.js';

describe('prefixComplete', () => {
  const complete = prefixComplete(['sailing', 'navigation', 'engine']);

  it('suggests options that start with the typed value, case-insensitively', () => {
    expect(complete('sa')).toEqual(['sailing']);
    expect(complete('NAV')).toEqual(['navigation']);
  });

  it('suggests everything for an empty value', () => {
    expect(complete('')).toEqual(['sailing', 'navigation', 'engine']);
  });
});

describe('optionalCompletable', () => {
  const field = optionalCompletable('an area', prefixComplete(['sailing', 'engine']));

  it('stays optional (accepts a string or undefined)', () => {
    expect((field as z.ZodTypeAny).safeParse(undefined).success).toBe(true);
    expect((field as z.ZodTypeAny).safeParse('sailing').success).toBe(true);
  });

  it('carries completion metadata on the outer optional (the handler-side check)', () => {
    // The SDK's handlePromptCompletion checks isCompletable on the outer field.
    expect(isCompletable(field)).toBe(true);
  });

  it('carries completion metadata on the inner type (the capability-enable check)', () => {
    // The SDK's capability check unwraps ZodOptional and inspects the inner type.
    const inner = (field as unknown as { _def: { innerType: unknown } })._def.innerType;
    expect(isCompletable(inner)).toBe(true);
  });
});
