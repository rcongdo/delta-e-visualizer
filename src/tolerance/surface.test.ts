import { describe, expect, it } from "vitest";
import { deltaE } from "../color/deltaE";
import { buildToleranceSurface } from "./surface";

describe("buildToleranceSurface", () => {
  it("builds a CIE76 sphere at the exact tolerance radius", () => {
    const center = { l: 50, a: 0, b: 0 };
    const surface = buildToleranceSurface({ center, formula: "cie76", tolerance: 2 });

    expect(surface.vertices.length).toBeGreaterThan(100);
    expect(deltaE("cie76", surface.vertices[0], center)).toBeCloseTo(2, 6);
  });

  it("builds a finite CIEDE2000 triangle mesh", () => {
    const surface = buildToleranceSurface({
      center: { l: 50, a: 20, b: 30 },
      formula: "ciede2000",
      tolerance: 2,
    });

    expect(surface.vertices.length).toBeGreaterThan(100);
    expect(surface.indices.length).toBeGreaterThan(100);
    for (const vertex of surface.vertices) {
      expect(Number.isFinite(vertex.l)).toBe(true);
      expect(Number.isFinite(vertex.a)).toBe(true);
      expect(Number.isFinite(vertex.b)).toBe(true);
    }
  });
});
