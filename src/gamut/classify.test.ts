import { describe, expect, it } from "vitest";
import type { ResolvedColor } from "../types";
import { classifyAchievableDeltaE, computeGamutResults, countGamutStatuses } from "./classify";
import { IN_GAMUT_CUTOFF } from "./cutoff";
import type { Reproduction } from "./types";

describe("classifyAchievableDeltaE", () => {
  it("uses a 1.0 in-gamut cutoff", () => {
    expect(IN_GAMUT_CUTOFF).toBe(1);
  });

  it.each([
    [0, 2, "in"],
    [1, 2, "in"],
    [1.01, 2, "within"],
    [2, 2, "within"],
    [2.01, 2, "out"],
  ] as const)("classifies %s at tolerance %s as %s", (value, tolerance, status) => {
    expect(classifyAchievableDeltaE(value, tolerance)).toBe(status);
  });

  it("treats NaN as out of tolerance", () => {
    expect(classifyAchievableDeltaE(Number.NaN, 2)).toBe("out");
  });

  it("never shows amber when the tolerance is below the cutoff", () => {
    expect(classifyAchievableDeltaE(0.4, 0.5)).toBe("in");
    expect(classifyAchievableDeltaE(0.6, 0.5)).toBe("out");
  });
});

describe("computeGamutResults", () => {
  const colors: ResolvedColor[] = [
    { id: "a", name: "A", lab: { l: 50, a: 0, b: 0 }, displayRgb: "rgb(0, 0, 0)", source: "lab" },
    { id: "b", name: "B", lab: { l: 50, a: 10, b: 0 }, displayRgb: "rgb(0, 0, 0)", source: "lab" },
    { id: "c", name: "C", lab: { l: 50, a: 0, b: 0 }, displayRgb: "rgb(0, 0, 0)", source: "lab" },
  ];
  const reproductions = new Map<string, Reproduction>([
    ["a", { reproducedLab: { l: 50, a: 0.5, b: 0 }, deviceValues: [0, 0, 0, 0] }],
    ["b", { reproducedLab: { l: 50, a: 8.5, b: 0 }, deviceValues: [1, 2, 3, 4] }],
    ["c", { reproducedLab: { l: 50, a: 3, b: 4 }, deviceValues: [5, 6, 7, 8] }],
  ]);

  it("measures achievable Delta E with the selected formula and classifies it", () => {
    const results = computeGamutResults(colors, reproductions, "cie76", 2);

    expect(results.get("a")).toMatchObject({ achievableDeltaE: 0.5, status: "in" });
    expect(results.get("b")).toMatchObject({ achievableDeltaE: 1.5, status: "within", deviceValues: [1, 2, 3, 4] });
    expect(results.get("c")).toMatchObject({ achievableDeltaE: 5, status: "out" });
  });

  it("skips colors without a reproduction", () => {
    const results = computeGamutResults(colors, new Map([["a", reproductions.get("a")!]]), "cie76", 2);

    expect([...results.keys()]).toEqual(["a"]);
  });

  it("counts statuses", () => {
    expect(countGamutStatuses(computeGamutResults(colors, reproductions, "cie76", 2))).toEqual({
      in: 1,
      within: 1,
      out: 1,
    });
  });
});
