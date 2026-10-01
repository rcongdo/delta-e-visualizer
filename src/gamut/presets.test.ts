// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GAMUT_PRESETS, findPreset, presetUrl } from "./presets";
import { lcmsReady, readPresetBytes } from "./testSupport";

describe("gamut presets", () => {
  it("lists CRPC1 through CRPC7 in order", () => {
    expect(GAMUT_PRESETS.map((preset) => preset.id)).toEqual([
      "crpc1",
      "crpc2",
      "crpc3",
      "crpc4",
      "crpc5",
      "crpc6",
      "crpc7",
    ]);
  });

  it.each(GAMUT_PRESETS)("$label is bundled and opens in LittleCMS", async (preset) => {
    const lcms = await lcmsReady;
    const bytes = readPresetBytes(preset.file);
    const profile = lcms.cmsOpenProfileFromMem(bytes, bytes.byteLength);

    expect(profile).not.toBe(0);
    lcms.cmsCloseProfile(profile);
  });

  it("builds URLs under the app base path", () => {
    expect(presetUrl(findPreset("crpc6")!)).toBe("/profiles/GRACoL2013_CRPC6.icc");
  });

  it("returns null for unknown presets", () => {
    expect(findPreset("crpc9")).toBeNull();
  });
});
