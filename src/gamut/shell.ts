import { extractIsosurface } from "./marchingTetrahedra";
import type { GamutShell } from "./types";

const STEP = 2;
const L_MIN = 0;
const L_MAX = 100;
const AB_MIN = -128;
const AB_MAX = 128;

/**
 * Samples a Lab grid, round-trips it through the profile, and returns the
 * surface where the round-trip error (CIE76) equals `cutoff`. Uses CIE76 so
 * the shell does not change shape when the user switches Delta E formula.
 *
 * The shell follows the classification field exactly. Where round-trip noise
 * sits near the cutoff (mostly in the shadows), it can contain tiny
 * single-sample islands and thin tunnels. This is intentional, so the drawn
 * boundary agrees with point status.
 */
export function buildGamutShell(
  roundTrip: (labs: Float32Array) => { reproducedLabs: Float32Array },
  cutoff: number,
): GamutShell {
  const nx = Math.round((L_MAX - L_MIN) / STEP) + 1;
  const ny = Math.round((AB_MAX - AB_MIN) / STEP) + 1;
  const nz = ny;
  const count = nx * ny * nz;
  const labs = new Float32Array(count * 3);

  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const offset = (i + nx * (j + ny * k)) * 3;
        labs[offset] = L_MIN + i * STEP;
        labs[offset + 1] = AB_MIN + j * STEP;
        labs[offset + 2] = AB_MIN + k * STEP;
      }
    }
  }

  const { reproducedLabs } = roundTrip(labs);
  const values = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    values[index] = Math.hypot(
      reproducedLabs[offset] - labs[offset],
      reproducedLabs[offset + 1] - labs[offset + 1],
      reproducedLabs[offset + 2] - labs[offset + 2],
    );
  }

  return extractIsosurface({ values, nx, ny, nz, origin: [L_MIN, AB_MIN, AB_MIN], step: [STEP, STEP, STEP] }, cutoff);
}
