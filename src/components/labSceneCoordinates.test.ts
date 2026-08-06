import { describe, expect, it } from "vitest";
import { labToSceneVector } from "./labSceneCoordinates";

describe("labToSceneVector", () => {
  it("flips the Lab a axis for scene coordinates", () => {
    const vector = labToSceneVector({ l: 42, a: 18, b: -9 });

    expect(vector.x).toBe(-18);
    expect(vector.y).toBe(42);
    expect(vector.z).toBe(-9);
  });
});
