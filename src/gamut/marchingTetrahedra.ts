export type ScalarGrid = {
  /** Sample at (i, j, k) is values[i + nx * (j + ny * k)]. */
  values: Float32Array;
  nx: number;
  ny: number;
  nz: number;
  /** World position of sample (0, 0, 0). */
  origin: readonly [number, number, number];
  /** World distance between samples along each axis (must be positive). */
  step: readonly [number, number, number];
};

export type IsoSurface = {
  positions: Float32Array;
  indices: Uint32Array;
};

// Kuhn split of a cube into six tetrahedra sharing the 0–7 diagonal.
// Corner bit 1 = +i, bit 2 = +j, bit 4 = +k. Every cube uses the same split,
// so neighbouring faces match and the surface has no cracks.
const TETRAHEDRA = [
  [0, 1, 3, 7],
  [0, 3, 2, 7],
  [0, 2, 6, 7],
  [0, 6, 4, 7],
  [0, 4, 5, 7],
  [0, 5, 1, 7],
] as const;

// Samples outside the grid count as far outside so the surface always closes.
const OUTSIDE_VALUE = 1e9;

/** Triangulates the surface where values cross `iso`. Inside means value < iso. Triangles face outward. */
export function extractIsosurface(grid: ScalarGrid, iso: number): IsoSurface {
  const { values, nx, ny, nz, origin, step } = grid;
  const paddedX = nx + 2;
  const paddedY = ny + 2;
  const paddedCount = paddedX * paddedY * (nz + 2);

  const positions: number[] = [];
  const indices: number[] = [];
  const vertexByEdge = new Map<number, number>();

  const cornerKey = new Float64Array(8);
  const cornerValue = new Float64Array(8);
  const cornerPosition = new Float64Array(24);

  const sample = (i: number, j: number, k: number) =>
    i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? OUTSIDE_VALUE : values[i + nx * (j + ny * k)];

  const edgeVertex = (a: number, b: number) => {
    const keyA = cornerKey[a];
    const keyB = cornerKey[b];
    const key = keyA < keyB ? keyA * paddedCount + keyB : keyB * paddedCount + keyA;
    const existing = vertexByEdge.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const t = (iso - cornerValue[a]) / (cornerValue[b] - cornerValue[a]);
    for (let axis = 0; axis < 3; axis += 1) {
      const from = cornerPosition[a * 3 + axis];
      const to = cornerPosition[b * 3 + axis];
      positions.push(origin[axis] + (from + t * (to - from)) * step[axis]);
    }
    const index = positions.length / 3 - 1;
    vertexByEdge.set(key, index);
    return index;
  };

  const pushTriangle = (v0: number, v1: number, v2: number, inside: number[], outside: number[]) => {
    // Outward direction: from the inside corners' centroid toward the outside corners' centroid.
    const direction = [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      const insideMean = inside.reduce((sum, corner) => sum + cornerPosition[corner * 3 + axis], 0) / inside.length;
      const outsideMean = outside.reduce((sum, corner) => sum + cornerPosition[corner * 3 + axis], 0) / outside.length;
      direction[axis] = (outsideMean - insideMean) * step[axis];
    }

    const p = (vertex: number, axis: number) => positions[vertex * 3 + axis];
    const u = [p(v1, 0) - p(v0, 0), p(v1, 1) - p(v0, 1), p(v1, 2) - p(v0, 2)];
    const v = [p(v2, 0) - p(v0, 0), p(v2, 1) - p(v0, 1), p(v2, 2) - p(v0, 2)];
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const facing = normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2];

    if (facing < 0) {
      indices.push(v0, v2, v1);
    } else {
      indices.push(v0, v1, v2);
    }
  };

  const polygonize = (tetrahedron: readonly number[]) => {
    const inside: number[] = [];
    const outside: number[] = [];
    tetrahedron.forEach((corner) => (cornerValue[corner] < iso ? inside : outside).push(corner));

    if (inside.length === 1) {
      const [a] = inside;
      pushTriangle(edgeVertex(a, outside[0]), edgeVertex(a, outside[1]), edgeVertex(a, outside[2]), inside, outside);
    } else if (inside.length === 3) {
      const [a] = outside;
      pushTriangle(edgeVertex(a, inside[0]), edgeVertex(a, inside[1]), edgeVertex(a, inside[2]), inside, outside);
    } else if (inside.length === 2) {
      const [i0, i1] = inside;
      const [o0, o1] = outside;
      const p0 = edgeVertex(i0, o0);
      const p1 = edgeVertex(i0, o1);
      const p2 = edgeVertex(i1, o1);
      const p3 = edgeVertex(i1, o0);
      pushTriangle(p0, p1, p2, inside, outside);
      pushTriangle(p0, p2, p3, inside, outside);
    }
  };

  for (let k = -1; k < nz; k += 1) {
    for (let j = -1; j < ny; j += 1) {
      for (let i = -1; i < nx; i += 1) {
        let insideCount = 0;
        for (let corner = 0; corner < 8; corner += 1) {
          const ci = i + (corner & 1);
          const cj = j + ((corner >> 1) & 1);
          const ck = k + ((corner >> 2) & 1);
          const value = sample(ci, cj, ck);
          cornerValue[corner] = value;
          cornerKey[corner] = ci + 1 + paddedX * (cj + 1 + paddedY * (ck + 1));
          cornerPosition[corner * 3] = ci;
          cornerPosition[corner * 3 + 1] = cj;
          cornerPosition[corner * 3 + 2] = ck;
          if (value < iso) {
            insideCount += 1;
          }
        }

        if (insideCount === 0 || insideCount === 8) {
          continue;
        }
        TETRAHEDRA.forEach(polygonize);
      }
    }
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
