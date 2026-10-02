import { describe, expect, it } from "vitest";
import type { GamutResult } from "../gamut/types";
import type { ResolvedColor } from "../types";
import { arrangeColors, type ListOptions } from "./colorListModel";

const color = (id: string, name: string, l: number, a: number, b: number): ResolvedColor => ({
  id,
  name,
  lab: { l, a, b },
  displayRgb: "rgb(0, 0, 0)",
  source: "lab",
});

const colors = [
  color("red", "Red 10", 50, 60, 40),
  color("blue", "Blue", 30, 10, -60),
  color("gray", "Gray", 70, 0, 0),
  color("red2", "Red 2", 45, 70, 50),
];

const result = (achievableDeltaE: number, status: GamutResult["status"]): GamutResult => ({
  achievableDeltaE,
  status,
  reproducedLab: { l: 0, a: 0, b: 0 },
  deviceValues: [],
});

const results = new Map<string, GamutResult>([
  ["red", result(3.2, "out")],
  ["blue", result(1.4, "within")],
  ["gray", result(0.2, "in")],
  ["red2", result(5.1, "out")],
]);

const options = (overrides: Partial<ListOptions> = {}): ListOptions => ({
  query: "",
  sortKey: "name",
  direction: "asc",
  statusFilter: "all",
  ...overrides,
});

const ids = (list: ResolvedColor[]) => list.map((entry) => entry.id);

describe("arrangeColors", () => {
  it("sorts names naturally", () => {
    expect(ids(arrangeColors(colors, options(), null))).toEqual(["blue", "gray", "red2", "red"]);
  });

  it("sorts by achievable Delta E in both directions", () => {
    expect(ids(arrangeColors(colors, options({ sortKey: "deltaE" }), results))).toEqual(["gray", "blue", "red", "red2"]);
    expect(ids(arrangeColors(colors, options({ sortKey: "deltaE", direction: "desc" }), results))).toEqual([
      "red2",
      "red",
      "blue",
      "gray",
    ]);
  });

  it("sorts by L*, chroma, and hue", () => {
    expect(ids(arrangeColors(colors, options({ sortKey: "l" }), null))).toEqual(["blue", "red2", "red", "gray"]);
    expect(ids(arrangeColors(colors, options({ sortKey: "chroma" }), null))).toEqual(["gray", "blue", "red", "red2"]);
    expect(ids(arrangeColors(colors, options({ sortKey: "hue" }), null))).toEqual(["gray", "red", "red2", "blue"]);
  });

  it("filters by status and combines with the text query", () => {
    expect(ids(arrangeColors(colors, options({ statusFilter: "out" }), results))).toEqual(["red2", "red"]);
    expect(ids(arrangeColors(colors, options({ statusFilter: "out", query: "10" }), results))).toEqual(["red"]);
  });

  it("ignores gamut sort and status filter when no profile is loaded", () => {
    expect(ids(arrangeColors(colors, options({ sortKey: "deltaE", statusFilter: "in" }), null))).toEqual([
      "blue",
      "gray",
      "red2",
      "red",
    ]);
  });
});
