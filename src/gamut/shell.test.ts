// @vitest-environment node
import { describe, expect, it } from "vitest";
import { IN_GAMUT_CUTOFF } from "./cutoff";
import { createProfileEngine } from "./engine";
import { buildGamutShell } from "./shell";
import { countOpenEdges, lcmsReady, readPresetBytes } from "./testSupport";

describe("buildGamutShell", () => {
  it("builds a closed CRPC6 shell spanning its black and paper white", async () => {
    const engine = createProfileEngine(await lcmsReady, readPresetBytes("GRACoL2013_CRPC6.icc"));
    const shell = buildGamutShell(engine.roundTrip, IN_GAMUT_CUTOFF);
    engine.dispose();

    expect(shell.indices.length).toBeGreaterThan(3000);
    expect(countOpenEdges(shell.indices)).toBe(0);

    let minL = Infinity;
    let maxL = -Infinity;
    for (let offset = 0; offset < shell.positions.length; offset += 3) {
      minL = Math.min(minL, shell.positions[offset]);
      maxL = Math.max(maxL, shell.positions[offset]);
    }
    expect(minL).toBeGreaterThan(2);
    expect(minL).toBeLessThan(20);
    expect(maxL).toBeGreaterThan(90);
    expect(maxL).toBeLessThan(100);
  }, 60_000);
});
