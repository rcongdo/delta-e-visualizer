// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deltaE } from "../color/deltaE";
import { classifyAchievableDeltaE } from "./classify";
import { IN_GAMUT_CUTOFF } from "./cutoff";
import { createProfileEngine, type ProfileEngine } from "./engine";
import { lcmsReady, readPresetBytes } from "./testSupport";

const labAt = (values: Float32Array, index = 0) => ({
  l: values[index * 3],
  a: values[index * 3 + 1],
  b: values[index * 3 + 2],
});

describe("createProfileEngine", () => {
  let crpc6: ProfileEngine;
  let crpc1: ProfileEngine;

  beforeAll(async () => {
    const lcms = await lcmsReady;
    crpc6 = createProfileEngine(lcms, readPresetBytes("GRACoL2013_CRPC6.icc"));
    crpc1 = createProfileEngine(lcms, readPresetBytes("CGATS21_CRPC1.icc"));
  });

  afterAll(() => {
    crpc6.dispose();
    crpc1.dispose();
  });

  it("reports profile info", () => {
    expect(crpc6.info).toEqual({
      name: "GRACoL2013_CRPC6.icc",
      colorSpace: "CMYK",
      channelNames: ["C", "M", "Y", "K"],
    });
  });

  it("maps unprinted paper to the CRPC6 paper white in absolute colorimetric", () => {
    const paper = labAt(crpc6.deviceToLab(new Float32Array([0, 0, 0, 0])));

    expect(Math.abs(paper.l - 95)).toBeLessThan(0.5);
    expect(Math.abs(paper.a - 1)).toBeLessThan(0.5);
    expect(Math.abs(paper.b + 4)).toBeLessThan(0.5);
  });

  it("round-trips a printable mid-tone within the in-gamut cutoff", () => {
    const target = crpc6.deviceToLab(new Float32Array([40, 30, 20, 0]));
    const { reproducedLabs } = crpc6.roundTrip(target);

    expect(deltaE("ciede2000", labAt(reproducedLabs), labAt(target))).toBeLessThanOrEqual(IN_GAMUT_CUTOFF);
  });

  it("predicts near-zero ink for paper white", () => {
    const { deviceValues } = crpc6.roundTrip(new Float32Array([95, 1, -4]));

    expect(deviceValues).toHaveLength(4);
    deviceValues.forEach((value) => expect(value).toBeLessThan(1));
  });

  it("flags a very saturated magenta as out of tolerance on newsprint", () => {
    const target = new Float32Array([50, 100, 0]);
    const { reproducedLabs } = crpc1.roundTrip(target);
    const achievable = deltaE("ciede2000", labAt(reproducedLabs), labAt(target));

    expect(classifyAchievableDeltaE(achievable, 2)).toBe("out");
  });

  it("handles an empty batch", () => {
    const { reproducedLabs, deviceValues } = crpc6.roundTrip(new Float32Array(0));

    expect(reproducedLabs).toHaveLength(0);
    expect(deviceValues).toHaveLength(0);
  });

  it("rejects bytes that are not an ICC profile", async () => {
    const lcms = await lcmsReady;

    expect(() => createProfileEngine(lcms, new Uint8Array(200))).toThrow("Not an ICC profile.");
  });

  it("round-trips a multi-point batch the same as single points", () => {
    const labs = new Float32Array([95, 1, -4, 50, 20, -10, 70, -30, 40]);
    const batch = crpc6.roundTrip(labs);

    for (let i = 0; i < 3; i += 1) {
      const single = crpc6.roundTrip(labs.slice(i * 3, i * 3 + 3));
      single.reproducedLabs.forEach((value, j) => expect(Math.abs(batch.reproducedLabs[i * 3 + j] - value)).toBeLessThan(1e-4));
      single.deviceValues.forEach((value, j) => expect(Math.abs(batch.deviceValues[i * 4 + j] - value)).toBeLessThan(1e-4));
    }
  });

  it("rejects batches with the wrong length", () => {
    expect(() => crpc6.roundTrip(new Float32Array(4))).toThrow("Lab input length must be a multiple of 3.");
    expect(() => crpc6.deviceToLab(new Float32Array(5))).toThrow("Device input length must be a multiple of 4.");
  });

  it("disposes idempotently and leaves other engines working", async () => {
    const lcms = await lcmsReady;
    const engine = createProfileEngine(lcms, readPresetBytes("GRACoL2013_CRPC6.icc"));

    engine.dispose();
    expect(() => engine.dispose()).not.toThrow();

    const fresh = createProfileEngine(lcms, readPresetBytes("GRACoL2013_CRPC6.icc"));
    expect(fresh.roundTrip(new Float32Array([95, 1, -4])).deviceValues).toHaveLength(4);
    fresh.dispose();
  });

  it("throws when used after dispose", async () => {
    const lcms = await lcmsReady;
    const engine = createProfileEngine(lcms, readPresetBytes("GRACoL2013_CRPC6.icc"));
    engine.dispose();

    expect(() => engine.roundTrip(new Float32Array([95, 1, -4]))).toThrow("Profile engine has been disposed.");
    expect(() => engine.deviceToLab(new Float32Array(4))).toThrow("Profile engine has been disposed.");
  });

  it("survives a 20 MB profile buffer without corrupting the module", async () => {
    const lcms = await lcmsReady;
    const original = readPresetBytes("GRACoL2013_CRPC6.icc");
    const padded = new Uint8Array(20 * 1024 * 1024);
    padded.set(original);

    try {
      createProfileEngine(lcms, padded).dispose();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const fresh = createProfileEngine(lcms, original);
    expect(fresh.roundTrip(new Float32Array([95, 1, -4])).deviceValues).toHaveLength(4);
    fresh.dispose();
  });
});
