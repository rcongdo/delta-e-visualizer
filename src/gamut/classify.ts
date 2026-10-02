import { deltaE } from "../color/deltaE";
import type { DeltaEFormula, ResolvedColor } from "../types";
import { IN_GAMUT_CUTOFF } from "./cutoff";
import type { GamutResult, GamutStatus, Reproduction } from "./types";

export const GAMUT_STATUS_COLORS: Record<GamutStatus, string> = {
  in: "#3fae5a",
  within: "#e0a526",
  out: "#d9483b",
};

export const GAMUT_STATUS_LABELS: Record<GamutStatus, string> = {
  in: "In gamut",
  within: "Within tolerance",
  out: "Out of tolerance",
};

export function classifyAchievableDeltaE(achievableDeltaE: number, tolerance: number): GamutStatus {
  if (!(achievableDeltaE <= tolerance)) {
    return "out";
  }
  return achievableDeltaE <= IN_GAMUT_CUTOFF ? "in" : "within";
}

export function computeGamutResults(
  colors: ResolvedColor[],
  reproductions: Map<string, Reproduction>,
  formula: DeltaEFormula,
  tolerance: number,
): Map<string, GamutResult> {
  const results = new Map<string, GamutResult>();

  colors.forEach((color) => {
    const reproduction = reproductions.get(color.id);
    if (!reproduction) {
      return;
    }

    const achievableDeltaE = deltaE(formula, reproduction.reproducedLab, color.lab);
    results.set(color.id, {
      ...reproduction,
      achievableDeltaE,
      status: classifyAchievableDeltaE(achievableDeltaE, tolerance),
    });
  });

  return results;
}

export function countGamutStatuses(results: Map<string, GamutResult>): Record<GamutStatus, number> {
  const counts: Record<GamutStatus, number> = { in: 0, within: 0, out: 0 };
  results.forEach((result) => {
    counts[result.status] += 1;
  });
  return counts;
}
