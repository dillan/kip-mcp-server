import type { DesignSystem } from '../schema/schema-types.js';

export interface UnitChoiceOptions {
  /** The template's preferred display unit (wins if valid for the group). */
  preferred?: string | null;
  /** The widget slot's DEFAULT_CONFIG convertUnitTo (used if the preferred one is not valid). */
  slotDefault?: string | null;
}

/**
 * Chooses the `convertUnitTo` for a Signal K base unit.
 *
 * Preference order: the template's preferred unit, then the slot default, then the
 * base unit itself (no conversion). When the base unit is in no known group we
 * can't convert, so the slot default (or the base unit) is passed through.
 *
 * STUB: implemented in the GREEN step.
 */
export function chooseConvertUnit(
  _design: DesignSystem,
  _skUnit: string,
  _options: UnitChoiceOptions = {},
): string {
  return 'unitless';
}
