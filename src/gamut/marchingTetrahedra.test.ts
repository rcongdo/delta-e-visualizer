// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractIsosurface, type ScalarGrid } from "./marchingTetrahedra";
import { countInconsistentEdges, countOpenEdges, signedVolume } from "./testSupport";

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

describe("extractIsosurface", () => {
  it("extracts a closed sphere with outward-facing triangles", () => {
    const { positions, indices } = extractIsosurface(sphereGrid(), 6);

    expect(indices.length).toBeGreaterThan(300);
    expect(countOpenEdges(indices)).toBe(0);
    expect(countInconsistentEdges(indices)).toBe(0);
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

  it("treats non-finite samples as outside", () => {
    const values = new Float32Array(27);
    values[26] = Number.NaN;
    const { positions, indices } = extractIsosurface(
      { values, nx: 3, ny: 3, nz: 3, origin: [0, 0, 0], step: [1, 1, 1] },
      1,
    );

    expect(indices.length).toBeGreaterThan(0);
    positions.forEach((value) => expect(Number.isFinite(value)).toBe(true));
    expect(countOpenEdges(indices)).toBe(0);
  });

  it("extracts a closed, consistently oriented ellipsoid on an anisotropic grid", () => {
    const [nx, ny, nz] = [21, 15, 11];
    const step = [0.5, 1, 2] as const;
    const [a, b, c] = [4.3, 5.1, 7.7];
    const values = new Float32Array(nx * ny * nz);
    for (let k = 0; k < nz; k += 1) {
      for (let j = 0; j < ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const x = (i - (nx - 1) / 2) * step[0];
          const y = (j - (ny - 1) / 2) * step[1];
          const z = (k - (nz - 1) / 2) * step[2];
          values[i + nx * (j + ny * k)] = Math.sqrt((x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2);
        }
      }
    }
    const origin = [-((nx - 1) / 2) * step[0], -((ny - 1) / 2) * step[1], -((nz - 1) / 2) * step[2]] as const;
    const { positions, indices } = extractIsosurface({ values, nx, ny, nz, origin, step }, 1);

    expect(indices.length).toBeGreaterThan(0);
    expect(countOpenEdges(indices)).toBe(0);
    expect(countInconsistentEdges(indices)).toBe(0);
    const expected = (4 / 3) * Math.PI * a * b * c;
    expect(signedVolume(positions, indices)).toBeGreaterThan(expected * 0.9);
    expect(signedVolume(positions, indices)).toBeLessThan(expected * 1.1);
  });
});
