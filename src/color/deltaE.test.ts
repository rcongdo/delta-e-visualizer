import { describe, expect, it } from "vitest";
import { deltaE } from "./deltaE";
import type { DeltaEFormula, LabColor } from "../types";

describe("deltaE", () => {
  it("calculates CIE76 as Euclidean distance in Lab space", () => {
    expect(deltaE("cie76", { l: 50, a: 2, b: 3 }, { l: 52, a: 4, b: 4 })).toBeCloseTo(3, 6);
  });

  it("matches a CIEDE2000 reference pair", () => {
    expect(
      deltaE("ciede2000", { l: 50, a: 2.6772, b: -79.7751 }, { l: 50, a: 0, b: -82.7485 }),
    ).toBeCloseTo(2.0425, 4);
  });

  it("weights CIE94 from the standard color", () => {
    expect(deltaE("cie94", { l: 50, a: 20, b: 20 }, { l: 50, a: 10, b: 0 })).toBeCloseTo(16.8609, 4);
  });

  it("weights CMC l:c from the standard color", () => {
    expect(deltaE("cmc", { l: 50, a: 20, b: 20 }, { l: 50, a: 10, b: 0 })).toBeCloseTo(21.365, 3);
  });

  it.each<DeltaEFormula>(["cie76", "cie94", "ciede2000", "cmc"])(
    "returns zero for identical colors with %s",
    (formula) => {
      const color: LabColor = { l: 60, a: -12, b: 24 };

      expect(deltaE(formula, color, color)).toBeCloseTo(0, 12);
    },
  );
});
