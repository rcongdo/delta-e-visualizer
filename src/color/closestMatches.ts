import type { DeltaEFormula, LabColor, ResolvedColor } from "../types";
import { deltaE } from "./deltaE";

export type ColorMatch = {
  color: ResolvedColor;
  deltaE: number;
};

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Rank library colors by Delta E from a sample Lab value and return the closest `count`,
 * best match first. The sample is treated as the measured color and each library color
 * as the standard, matching how the manual comparison is computed.
 */
export function findClosestMatches(
  colors: ResolvedColor[],
  sample: LabColor,
  formula: DeltaEFormula,
  count = 3,
): ColorMatch[] {
  if (count <= 0) {
    return [];
  }

  return colors
    .map((color) => ({ color, deltaE: deltaE(formula, sample, color.lab) }))
    .filter((match) => Number.isFinite(match.deltaE))
    .sort((left, right) => left.deltaE - right.deltaE || nameCollator.compare(left.color.name, right.color.name))
    .slice(0, count);
}
