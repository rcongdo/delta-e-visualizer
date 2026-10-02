import { describe, expect, it } from "vitest";
import { formatDeviceValues } from "./format";

describe("formatDeviceValues", () => {
  it("labels and rounds each channel", () => {
    expect(formatDeviceValues(["C", "M", "Y", "K"], [12.4, 86.6, 0, 3.49])).toBe("C 12  M 87  Y 0  K 3");
  });
});
