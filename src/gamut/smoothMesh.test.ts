// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractIsosurface } from "./marchingTetrahedra";
import { smoothMesh } from "./smoothMesh";
import { signedVolume } from "./testSupport";

// Like a round-trip error field: ~0 inside the solid, growing linearly outside.
// The kink at the boundary is what makes the extracted surface stair-step.
function sphereMesh() {
  const n = 41;
  const values = new Float32Array(n * n * n);
  for (let k = 0; k < n; k += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        values[i + n * (j + n * k)] = Math.max(0, Math.hypot(i - 20, j - 20, k - 20) - 15.3);
      }
    }
  }
  return extractIsosurface({ values, nx: n, ny: n, nz: n, origin: [-20, -20, -20], step: [1, 1, 1] }, 1);
}

/** Mean angle in degrees between the normals of triangles that share an edge. */
function roughness(positions: Float32Array, indices: Uint32Array) {
  const normals: number[][] = [];
  const triangleByEdge = new Map<string, number>();
  let total = 0;
  let pairs = 0;

  for (let offset = 0; offset < indices.length; offset += 3) {
    const [a, b, c] = [indices[offset], indices[offset + 1], indices[offset + 2]].map((index) => [
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    ]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal) || 1;
    const triangle = normals.push(normal.map((value) => value / length)) - 1;

    for (let edge = 0; edge < 3; edge += 1) {
      const from = indices[offset + edge];
      const to = indices[offset + ((edge + 1) % 3)];
      const key = from < to ? `${from}-${to}` : `${to}-${from}`;
      const other = triangleByEdge.get(key);
      if (other === undefined) {
        triangleByEdge.set(key, triangle);
      } else {
        const dot = normals[other].reduce((sum, value, axis) => sum + value * normals[triangle][axis], 0);
        total += (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
        pairs += 1;
      }
    }
  }
  return total / pairs;
}

describe("smoothMesh", () => {
  it("reduces surface roughness without shrinking the shape", () => {
    const mesh = sphereMesh();
    const smoothed = smoothMesh(mesh, 10);

    expect(roughness(smoothed.positions, smoothed.indices)).toBeLessThan(roughness(mesh.positions, mesh.indices) * 0.7);
    const volumeRatio = signedVolume(smoothed.positions, smoothed.indices) / signedVolume(mesh.positions, mesh.indices);
    expect(volumeRatio).toBeGreaterThan(0.97);
    expect(volumeRatio).toBeLessThan(1.03);
  });

  it("keeps the triangles and leaves the input untouched", () => {
    const mesh = sphereMesh();
    const original = Float32Array.from(mesh.positions);
    const smoothed = smoothMesh(mesh, 10);

    expect(smoothed.indices).toBe(mesh.indices);
    expect(smoothed.positions).toHaveLength(mesh.positions.length);
    expect(mesh.positions).toEqual(original);
  });

  it("returns an empty mesh unchanged", () => {
    const empty = { positions: new Float32Array(0), indices: new Uint32Array(0) };

    expect(smoothMesh(empty, 10).positions).toHaveLength(0);
  });
});
