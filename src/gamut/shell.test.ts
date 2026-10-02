// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createProfileEngine } from "./engine";
import { buildGamutShell } from "./shell";
import { lcmsReady, readPresetBytes } from "./testSupport";

const lightnessRange = (positions: Float32Array) => {
  let min = Infinity;
  let max = -Infinity;
  for (let offset = 0; offset < positions.length; offset += 3) {
    min = Math.min(min, positions[offset]);
    max = Math.max(max, positions[offset]);
  }
  return { min, max };
};

describe("buildGamutShell", () => {
  it("maps every face of the CMYK cube through the profile", async () => {
    const engine = createProfileEngine(await lcmsReady, readPresetBytes("GRACoL2013_CRPC6.icc"));
    const shell = buildGamutShell(engine, 5);
    engine.dispose();

    // 6 channel pairs × 4 fixed combinations = 24 faces of 5 × 5 samples, 4 × 4 quads each.
    expect(shell.positions).toHaveLength(24 * 25 * 3);
    expect(shell.indices).toHaveLength(24 * 16 * 6);
    shell.positions.forEach((value) => expect(Number.isFinite(value)).toBe(true));
    shell.indices.forEach((index) => expect(index).toBeLessThan(24 * 25));
  });

  it("spans the profile's black and paper white", async () => {
    const engine = createProfileEngine(await lcmsReady, readPresetBytes("GRACoL2013_CRPC6.icc"));
    const { min, max } = lightnessRange(buildGamutShell(engine).positions);
    engine.dispose();

    expect(min).toBeGreaterThan(2);
    expect(min).toBeLessThan(20);
    expect(max).toBeGreaterThan(94);
    expect(max).toBeLessThan(96);
  });

  it("caps face resolution for profiles with more than four channels", () => {
    const calls: number[] = [];
    const fakeEngine = {
      info: { name: "fake", colorSpace: "5CLR", channelNames: ["Ch1", "Ch2", "Ch3", "Ch4", "Ch5"] },
      deviceFullScale: 100,
      deviceToLab: (device: Float32Array) => {
        calls.push(device.length / 5);
        return new Float32Array((device.length / 5) * 3);
      },
    };
    buildGamutShell(fakeEngine, 23);

    // 10 channel pairs × 8 fixed combinations = 80 faces of 11 × 11 samples, in one transform call.
    expect(calls).toEqual([80 * 121]);
  });
});
