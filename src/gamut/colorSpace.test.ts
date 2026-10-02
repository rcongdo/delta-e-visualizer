import { describe, expect, it } from "vitest";
import { describeColorSpace } from "./colorSpace";

describe("describeColorSpace", () => {
  it("describes CMYK as percent ink", () => {
    expect(describeColorSpace(6)).toEqual({ colorSpace: "CMYK", channelNames: ["C", "M", "Y", "K"], displayScale: 1 });
  });

  it("describes RGB in 0–255", () => {
    expect(describeColorSpace(4)).toEqual({ colorSpace: "RGB", channelNames: ["R", "G", "B"], displayScale: 255 });
  });

  it("describes CMY and Gray", () => {
    expect(describeColorSpace(5)?.channelNames).toEqual(["C", "M", "Y"]);
    expect(describeColorSpace(3)).toEqual({ colorSpace: "Gray", channelNames: ["Gray"], displayScale: 255 });
  });

  it("describes n-color spaces by channel count", () => {
    expect(describeColorSpace(21)).toEqual({
      colorSpace: "7CLR",
      channelNames: ["Ch1", "Ch2", "Ch3", "Ch4", "Ch5", "Ch6", "Ch7"],
      displayScale: 1,
    });
    expect(describeColorSpace(15)?.colorSpace).toBe("1CLR");
    expect(describeColorSpace(29)?.colorSpace).toBe("15CLR");
  });

  it("scales 1–4 channel n-color spaces as 0–1 floats and 5+ as ink percent", () => {
    expect(describeColorSpace(15)?.displayScale).toBe(100);
    expect(describeColorSpace(18)?.displayScale).toBe(100);
    expect(describeColorSpace(19)?.displayScale).toBe(1);
  });

  it("returns null just outside the n-color range", () => {
    expect(describeColorSpace(14)).toBeNull();
    expect(describeColorSpace(30)).toBeNull();
  });

  it("returns null for Lab, XYZ, and unknown spaces", () => {
    expect(describeColorSpace(10)).toBeNull();
    expect(describeColorSpace(9)).toBeNull();
    expect(describeColorSpace(0)).toBeNull();
  });
});
