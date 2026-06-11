import type { LabColor } from "../types";

export type XyzColor = {
  x: number;
  y: number;
  z: number;
};

export type SrgbColor = {
  r: number;
  g: number;
  b: number;
};

const D50_WHITE: XyzColor = { x: 0.96422, y: 1, z: 0.82521 };

const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const labPivot = (value: number) => {
  const cubed = value ** 3;
  return cubed > EPSILON ? cubed : (116 * value - 16) / KAPPA;
};

const xyzPivot = (value: number) => (value > EPSILON ? Math.cbrt(value) : (KAPPA * value + 16) / 116);

const linearToSrgb = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

export function labToXyz(lab: LabColor): XyzColor {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;

  return {
    x: D50_WHITE.x * labPivot(fx),
    y: D50_WHITE.y * labPivot(fy),
    z: D50_WHITE.z * labPivot(fz),
  };
}

export function xyzToLab(xyz: XyzColor): LabColor {
  const fx = xyzPivot(xyz.x / D50_WHITE.x);
  const fy = xyzPivot(xyz.y / D50_WHITE.y);
  const fz = xyzPivot(xyz.z / D50_WHITE.z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToSrgb(lab: LabColor): SrgbColor {
  const xyz = labToXyz(lab);

  const d65X = 0.9555766 * xyz.x - 0.0230393 * xyz.y + 0.0631636 * xyz.z;
  const d65Y = -0.0282895 * xyz.x + 1.0099416 * xyz.y + 0.0210077 * xyz.z;
  const d65Z = 0.0122982 * xyz.x - 0.020483 * xyz.y + 1.3299098 * xyz.z;

  const linearR = 3.2404542 * d65X - 1.5371385 * d65Y - 0.4985314 * d65Z;
  const linearG = -0.969266 * d65X + 1.8760108 * d65Y + 0.041556 * d65Z;
  const linearB = 0.0556434 * d65X - 0.2040259 * d65Y + 1.0572252 * d65Z;

  return {
    r: clamp01(linearToSrgb(linearR)),
    g: clamp01(linearToSrgb(linearG)),
    b: clamp01(linearToSrgb(linearB)),
  };
}

export function labToCssRgb(lab: LabColor): string {
  const rgb = labToSrgb(lab);
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);

  return `rgb(${r}, ${g}, ${b})`;
}
