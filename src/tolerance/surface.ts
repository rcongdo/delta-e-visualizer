import { deltaE } from "../color/deltaE";
import type { DeltaEFormula, LabColor } from "../types";

export type ToleranceSurfaceOptions = {
  center: LabColor;
  formula: DeltaEFormula;
  tolerance: number;
  rings?: number;
  segments?: number;
};

export type ToleranceSurface = {
  vertices: LabColor[];
  indices: number[];
};

type Direction = {
  l: number;
  a: number;
  b: number;
};

const MIN_RINGS = 2;
const MIN_SEGMENTS = 3;
const SEARCH_STEPS = 36;
const MAX_RADIUS = 4096;

function pointAt(center: LabColor, direction: Direction, radius: number): LabColor {
  return {
    l: center.l + direction.l * radius,
    a: center.a + direction.a * radius,
    b: center.b + direction.b * radius,
  };
}

function toleranceRadius(center: LabColor, formula: DeltaEFormula, tolerance: number, direction: Direction): number {
  if (tolerance <= 0) {
    return 0;
  }

  if (formula === "cie76") {
    return tolerance;
  }

  let low = 0;
  let high = Math.max(tolerance, 1);

  while (high < MAX_RADIUS && deltaE(formula, pointAt(center, direction, high), center) < tolerance) {
    low = high;
    high *= 2;
  }

  high = Math.min(high, MAX_RADIUS);

  for (let i = 0; i < SEARCH_STEPS; i += 1) {
    const mid = (low + high) / 2;
    const candidate = pointAt(center, direction, mid);

    if (deltaE(formula, candidate, center) < tolerance) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

function sphericalDirection(ring: number, segment: number, rings: number, segments: number): Direction {
  const theta = (Math.PI * ring) / rings;
  const phi = (2 * Math.PI * segment) / segments;
  const sinTheta = Math.sin(theta);

  return {
    l: Math.cos(theta),
    a: sinTheta * Math.cos(phi),
    b: sinTheta * Math.sin(phi),
  };
}

export function buildToleranceSurface({
  center,
  formula,
  tolerance,
  rings = 18,
  segments = 36,
}: ToleranceSurfaceOptions): ToleranceSurface {
  const ringCount = Math.max(MIN_RINGS, Math.floor(rings));
  const segmentCount = Math.max(MIN_SEGMENTS, Math.floor(segments));
  const targetTolerance = Math.max(0, tolerance);
  const vertices: LabColor[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= ringCount; ring += 1) {
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const direction = sphericalDirection(ring, segment, ringCount, segmentCount);
      const radius = toleranceRadius(center, formula, targetTolerance, direction);
      vertices.push(pointAt(center, direction, radius));
    }
  }

  for (let ring = 0; ring < ringCount; ring += 1) {
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const nextSegment = (segment + 1) % segmentCount;
      const current = ring * segmentCount + segment;
      const currentNext = ring * segmentCount + nextSegment;
      const below = (ring + 1) * segmentCount + segment;
      const belowNext = (ring + 1) * segmentCount + nextSegment;

      indices.push(current, below, currentNext, currentNext, below, belowNext);
    }
  }

  return { vertices, indices };
}
