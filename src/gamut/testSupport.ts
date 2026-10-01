import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { instantiate } from "lcms-wasm";

export const lcmsReady = instantiate();

export function readPresetBytes(file: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`../../public/profiles/${file}`, import.meta.url))));
}

/** Number of mesh edges not shared by exactly two triangles. 0 means the mesh is closed. */
export function countOpenEdges(indices: Uint32Array): number {
  const edgeCounts = new Map<string, number>();
  for (let offset = 0; offset < indices.length; offset += 3) {
    const corners = [indices[offset], indices[offset + 1], indices[offset + 2]];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = corners[edge];
      const b = corners[(edge + 1) % 3];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }
  let open = 0;
  edgeCounts.forEach((count) => {
    if (count !== 2) {
      open += 1;
    }
  });
  return open;
}

/** Number of undirected edges whose two triangle uses do not run in opposite directions. 0 means consistent orientation. */
export function countInconsistentEdges(indices: Uint32Array): number {
  const directed = new Map<string, number>();
  for (let offset = 0; offset < indices.length; offset += 3) {
    for (let edge = 0; edge < 3; edge += 1) {
      const key = `${indices[offset + edge]}-${indices[offset + ((edge + 1) % 3)]}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  let bad = 0;
  directed.forEach((count, key) => {
    const [a, b] = key.split("-");
    if (count !== 1 || directed.get(`${b}-${a}`) !== 1) {
      bad += 1;
    }
  });
  return bad;
}

/** Signed volume enclosed by a triangle mesh. Positive when triangles face outward. */
export function signedVolume(positions: Float32Array, indices: Uint32Array): number {
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
