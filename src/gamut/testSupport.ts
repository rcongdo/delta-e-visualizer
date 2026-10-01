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
