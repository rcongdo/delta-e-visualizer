// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractIsosurface, type ScalarGrid } from "./marchingTetrahedra";
import { countOpenEdges } from "./testSupport";

function sphereGrid(): ScalarGrid {
  const n = 21;
  const values = new Float32Array(n * n * n);
  for (let k = 0; k < n; k += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        values[i + n * (j + n * k)] = Math.hypot(i - 10, j - 10, k - 10);
      }
    }
  }
  return { values, nx: n, ny: n, nz: n, origin: [-10, -10, -10], step: [1, 1, 1] };
}

function signedVolume(positions: Float32Array, indices: Uint32Array) {
  let volume = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const [a, b, c] = [indices[offset], indices[offset + 1], indices[offset + 2]].map((index) => [
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    ]);
    volume +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return volume;
}

describe("extractIsosurface", () => {
  it("extracts a closed sphere with outward-facing triangles", () => {
    const { positions, indices } = extractIsosurface(sphereGrid(), 6);

    expect(indices.length).toBeGreaterThan(300);
    expect(countOpenEdges(indices)).toBe(0);
    for (let offset = 0; offset < positions.length; offset += 3) {
      const radius = Math.hypot(positions[offset], positions[offset + 1], positions[offset + 2]);
      expect(radius).toBeGreaterThan(5.5);
      expect(radius).toBeLessThan(6.5);
    }
    const expectedVolume = (4 / 3) * Math.PI * 6 ** 3;
    expect(signedVolume(positions, indices)).toBeGreaterThan(expectedVolume * 0.9);
    expect(signedVolume(positions, indices)).toBeLessThan(expectedVolume * 1.1);
  });

  it("closes surfaces that touch the edge of the grid", () => {
    const grid: ScalarGrid = {
      values: new Float32Array(27),
      nx: 3,
      ny: 3,
      nz: 3,
      origin: [0, 0, 0],
      step: [1, 1, 1],
    };
    const { indices } = extractIsosurface(grid, 1);

    expect(indices.length).toBeGreaterThan(0);
    expect(countOpenEdges(indices)).toBe(0);
  });

  it("returns an empty mesh when nothing is inside", () => {
    const grid: ScalarGrid = {
      values: new Float32Array(27).fill(5),
      nx: 3,
      ny: 3,
      nz: 3,
      origin: [0, 0, 0],
      step: [1, 1, 1],
    };
    const { positions, indices } = extractIsosurface(grid, 1);

    expect(positions).toHaveLength(0);
    expect(indices).toHaveLength(0);
  });
});
