import { loadBundledSchema } from '../schema/kip-schema.js';
import { chooseConvertUnit } from './units-match.js';

const design = loadBundledSchema().designSystem;

describe('chooseConvertUnit', () => {
  it('prefers the template unit when valid for the group', () => {
    expect(chooseConvertUnit(design, 'rad', { preferred: 'deg' })).toBe('deg');
    expect(chooseConvertUnit(design, 'm/s', { preferred: 'knots' })).toBe('knots');
  });

  it('falls back to the slot default when the preferred unit is invalid', () => {
    expect(chooseConvertUnit(design, 'rad', { preferred: 'bogus', slotDefault: 'deg' })).toBe(
      'deg',
    );
  });

  it('passes through the base unit when no preference is given', () => {
    expect(chooseConvertUnit(design, 'rad')).toBe('rad');
  });

  it('passes through the slot default for a unit in no group', () => {
    expect(chooseConvertUnit(design, 'not-a-unit', { slotDefault: 'x' })).toBe('x');
  });
});
