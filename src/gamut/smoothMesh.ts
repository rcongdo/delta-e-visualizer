import type { IsoSurface } from "./marchingTetrahedra";

// Taubin λ|μ smoothing: a shrinking pass followed by a slightly stronger
// inflating pass, which removes grid-step stair-stepping without the volume
// loss of plain Laplacian smoothing.
const LAMBDA = 0.5;
const MU = -0.53;

function vertexNeighbors(indices: Uint32Array, vertexCount: number): Uint32Array[] {
  const sets = Array.from({ length: vertexCount }, () => new Set<number>());
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset];
    const b = indices[offset + 1];
    const c = indices[offset + 2];
    sets[a].add(b).add(c);
    sets[b].add(a).add(c);
    sets[c].add(a).add(b);
  }
  return sets.map((set) => Uint32Array.from(set));
}

function relax(positions: Float32Array, neighbors: Uint32Array[], factor: number): Float32Array {
  const next = Float32Array.from(positions);
  neighbors.forEach((adjacent, vertex) => {
    if (adjacent.length === 0) {
      return;
    }
    for (let axis = 0; axis < 3; axis += 1) {
      let mean = 0;
      adjacent.forEach((neighbor) => {
        mean += positions[neighbor * 3 + axis];
      });
      mean /= adjacent.length;
      const offset = vertex * 3 + axis;
      next[offset] = positions[offset] + factor * (mean - positions[offset]);
    }
  });
  return next;
}

/** Returns a smoothed copy of the mesh; triangles are shared with the input. */
export function smoothMesh(mesh: IsoSurface, iterations: number): IsoSurface {
  const neighbors = vertexNeighbors(mesh.indices, mesh.positions.length / 3);
  let positions = mesh.positions;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    positions = relax(relax(positions, neighbors, LAMBDA), neighbors, MU);
  }
  return { positions: positions === mesh.positions ? Float32Array.from(positions) : positions, indices: mesh.indices };
}
