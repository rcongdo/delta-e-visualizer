export type ColorSpaceDescription = {
  colorSpace: string;
  channelNames: string[];
  /** Multiplier from LittleCMS float units to display units. */
  displayScale: number;
};

// LittleCMS pixel-type codes (lcms2.h PT_*).
const PT_GRAY = 3;
const PT_RGB = 4;
const PT_CMY = 5;
const PT_CMYK = 6;
const PT_MCH1 = 15;
const PT_MCH15 = 29;

/**
 * LittleCMS float formats use 0–100 for ink channels (CMY, CMYK, n-color)
 * and 0–1 for RGB and Gray, so displayScale brings both to familiar units.
 */
export function describeColorSpace(pixelType: number): ColorSpaceDescription | null {
  switch (pixelType) {
    case PT_GRAY:
      return { colorSpace: "Gray", channelNames: ["Gray"], displayScale: 255 };
    case PT_RGB:
      return { colorSpace: "RGB", channelNames: ["R", "G", "B"], displayScale: 255 };
    case PT_CMY:
      return { colorSpace: "CMY", channelNames: ["C", "M", "Y"], displayScale: 1 };
    case PT_CMYK:
      return { colorSpace: "CMYK", channelNames: ["C", "M", "Y", "K"], displayScale: 1 };
  }

  if (pixelType >= PT_MCH1 && pixelType <= PT_MCH15) {
    const channelCount = pixelType - PT_MCH1 + 1;
    return {
      colorSpace: `${channelCount}CLR`,
      channelNames: Array.from({ length: channelCount }, (_, index) => `Ch${index + 1}`),
      displayScale: 1,
    };
  }

  return null;
}
