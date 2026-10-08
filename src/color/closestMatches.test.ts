import { describe, expect, it } from "vitest";
import type { ResolvedColor } from "../types";
import { findClosestMatches } from "./closestMatches";

const color = (id: string, name: string, l: number, a: number, b: number): ResolvedColor => ({
  id,
  name,
  lab: { l, a, b },
  displayRgb: "rgb(0, 0, 0)",
  source: "lab",
});

const library = [
  color("far", "Far", 10, -40, 60),
  color("near", "Near", 50, 1, 0),
  color("exact", "Exact", 50, 0, 0),
  color("mid", "Mid", 55, 0, 0),
  color("closer", "Closer", 52, 0, 0),
];

describe("findClosestMatches", () => {
  it("returns the three closest colors, best match first", () => {
    const matches = findClosestMatches(library, { l: 50, a: 0, b: 0 }, "cie76");

    expect(matches.map((match) => match.color.id)).toEqual(["exact", "near", "closer"]);
    expect(matches.map((match) => match.deltaE)).toEqual([0, 1, 2]);
  });

  it("returns every color when the library has fewer than the requested count", () => {
    const matches = findClosestMatches(library.slice(0, 2), { l: 50, a: 0, b: 0 }, "cie76");

    expect(matches.map((match) => match.color.id)).toEqual(["near", "far"]);
  });

  it("returns nothing for an empty library or non-positive count", () => {
    expect(findClosestMatches([], { l: 50, a: 0, b: 0 }, "ciede2000")).toEqual([]);
    expect(findClosestMatches(library, { l: 50, a: 0, b: 0 }, "ciede2000", 0)).toEqual([]);
  });

  it("breaks Delta E ties by name", () => {
    const tied = [color("b", "Beta", 51, 0, 0), color("a", "Alpha", 49, 0, 0)];

    expect(findClosestMatches(tied, { l: 50, a: 0, b: 0 }, "cie76").map((match) => match.color.name)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("ranks using the chosen formula", () => {
    const matches = findClosestMatches(library, { l: 50, a: 0, b: 0 }, "ciede2000");

    expect(matches[0].color.id).toBe("exact");
    expect(matches).toHaveLength(3);
    expect(matches[1].deltaE).toBeLessThanOrEqual(matches[2].deltaE);
  });
});
