import type { ProfileEngine } from "./engine";
import type { GamutShell } from "./types";

const DEFAULT_FACE_SIZE = 23;
// n-color profiles have many more faces (21 pairs × 32 combinations for 7CLR), so keep each one coarse.
const MAX_FACE_SIZE_ABOVE_FOUR_CHANNELS = 11;

type ShellSource = Pick<ProfileEngine, "info" | "deviceToLab" | "deviceFullScale">;

/**
 * Maps every 2D face of the device cube through the profile (device → Lab,
 * absolute colorimetric). Each face lets two channels run 0–100% while every
 * other channel sits at 0% or 100%; together the faces trace the gamut's outer
 * envelope. The profile's A2B table is smooth, so the surface is too.
 *
 * Faces are separate grids (not a closed mesh) and some fold inside the
 * gamut, so render them double-sided and translucent. The shell shows what the
 * device can reach, which can be slightly larger than what the round trip
 * achieves (it does not apply the profile's B2A ink limits).
 */
export function buildGamutShell(source: ShellSource, faceSize = DEFAULT_FACE_SIZE): GamutShell {
  const channels = source.info.channelNames.length;
  const size = channels > 4 ? Math.min(faceSize, MAX_FACE_SIZE_ABOVE_FOUR_CHANNELS) : faceSize;
  const fixedCombinations = 2 ** Math.max(0, channels - 2);
  const faceCount = ((channels * (channels - 1)) / 2) * fixedCombinations;
  const samplesPerFace = size * size;
  if (faceCount === 0) {
    // A one-channel (Gray) profile has no 2D faces; its gamut is a line.
    return { positions: new Float32Array(0), indices: new Uint32Array(0) };
  }

  const device = new Float32Array(faceCount * samplesPerFace * channels);
  const indices = new Uint32Array(faceCount * (size - 1) * (size - 1) * 6);
  let sample = 0;
  let index = 0;

  for (let freeA = 0; freeA < channels; freeA += 1) {
    for (let freeB = freeA + 1; freeB < channels; freeB += 1) {
      const fixed = Array.from({ length: channels }, (_, channel) => channel).filter(
        (channel) => channel !== freeA && channel !== freeB,
      );

      for (let mask = 0; mask < fixedCombinations; mask += 1) {
        const faceStart = sample;
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const offset = sample * channels;
            fixed.forEach((channel, bit) => {
              device[offset + channel] = (mask >> bit) & 1 ? source.deviceFullScale : 0;
            });
            device[offset + freeA] = (x / (size - 1)) * source.deviceFullScale;
            device[offset + freeB] = (y / (size - 1)) * source.deviceFullScale;
            sample += 1;
          }
        }

        for (let y = 0; y < size - 1; y += 1) {
          for (let x = 0; x < size - 1; x += 1) {
            const corner = faceStart + y * size + x;
            indices.set([corner, corner + 1, corner + size, corner + 1, corner + size + 1, corner + size], index);
            index += 6;
          }
        }
      }
    }
  }

  return { positions: source.deviceToLab(device), indices };
}
