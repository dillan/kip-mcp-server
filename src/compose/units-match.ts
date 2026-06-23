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
 */
export function chooseConvertUnit(
  design: DesignSystem,
  skUnit: string,
  options: UnitChoiceOptions = {},
): string {
  const group = design.unitGroups.find((g) => g.measures.some((m) => m.measure === skUnit));
  const inGroup = (unit: string | null | undefined): boolean =>
    !!unit && !!group && group.measures.some((m) => m.measure === unit);

  if (inGroup(options.preferred)) return options.preferred as string;
  if (inGroup(options.slotDefault)) return options.slotDefault as string;
  if (group) return skUnit;
  return options.slotDefault ?? skUnit;
}
