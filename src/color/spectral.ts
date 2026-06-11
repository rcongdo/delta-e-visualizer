import { xyzToLab, type XyzColor } from "./lab";
import type { LabColor } from "../types";

export type SpectralSample = {
  wavelength: number;
  value: number;
};

type SpectralRow = {
  wavelength: number;
  illuminant: number;
  xBar: number;
  yBar: number;
  zBar: number;
};

const D50_WHITE: XyzColor = { x: 0.96422, y: 1, z: 0.82521 };

const SPECTRAL_DATA: SpectralRow[] = [
  { wavelength: 400, illuminant: 49.98, xBar: 0.0143, yBar: 0.0004, zBar: 0.0679 },
  { wavelength: 410, illuminant: 52.31, xBar: 0.0435, yBar: 0.0012, zBar: 0.2074 },
  { wavelength: 420, illuminant: 54.65, xBar: 0.1344, yBar: 0.004, zBar: 0.6456 },
  { wavelength: 430, illuminant: 68.7, xBar: 0.2839, yBar: 0.0116, zBar: 1.3856 },
  { wavelength: 440, illuminant: 82.75, xBar: 0.3483, yBar: 0.023, zBar: 1.7471 },
  { wavelength: 450, illuminant: 87.12, xBar: 0.3362, yBar: 0.038, zBar: 1.7721 },
  { wavelength: 460, illuminant: 91.49, xBar: 0.2908, yBar: 0.06, zBar: 1.6692 },
  { wavelength: 470, illuminant: 92.46, xBar: 0.1954, yBar: 0.091, zBar: 1.2876 },
  { wavelength: 480, illuminant: 93.43, xBar: 0.0956, yBar: 0.139, zBar: 0.813 },
  { wavelength: 490, illuminant: 90.06, xBar: 0.032, yBar: 0.208, zBar: 0.4652 },
  { wavelength: 500, illuminant: 86.68, xBar: 0.0049, yBar: 0.323, zBar: 0.272 },
  { wavelength: 510, illuminant: 95.77, xBar: 0.0093, yBar: 0.503, zBar: 0.1582 },
  { wavelength: 520, illuminant: 104.85, xBar: 0.0633, yBar: 0.71, zBar: 0.0782 },
  { wavelength: 530, illuminant: 110.94, xBar: 0.1655, yBar: 0.862, zBar: 0.0422 },
  { wavelength: 540, illuminant: 117.01, xBar: 0.2904, yBar: 0.954, zBar: 0.0203 },
  { wavelength: 550, illuminant: 117.41, xBar: 0.4334, yBar: 0.995, zBar: 0.0087 },
  { wavelength: 560, illuminant: 117.81, xBar: 0.5945, yBar: 0.995, zBar: 0.0039 },
  { wavelength: 570, illuminant: 116.34, xBar: 0.7621, yBar: 0.952, zBar: 0.0021 },
  { wavelength: 580, illuminant: 114.86, xBar: 0.9163, yBar: 0.87, zBar: 0.0017 },
  { wavelength: 590, illuminant: 115.39, xBar: 1.0263, yBar: 0.757, zBar: 0.0011 },
  { wavelength: 600, illuminant: 115.92, xBar: 1.0622, yBar: 0.631, zBar: 0.0008 },
  { wavelength: 610, illuminant: 112.37, xBar: 1.0026, yBar: 0.503, zBar: 0.0003 },
  { wavelength: 620, illuminant: 108.81, xBar: 0.8544, yBar: 0.381, zBar: 0.0002 },
  { wavelength: 630, illuminant: 109.08, xBar: 0.6424, yBar: 0.265, zBar: 0 },
  { wavelength: 640, illuminant: 109.35, xBar: 0.4479, yBar: 0.175, zBar: 0 },
  { wavelength: 650, illuminant: 108.58, xBar: 0.2835, yBar: 0.107, zBar: 0 },
  { wavelength: 660, illuminant: 107.8, xBar: 0.1649, yBar: 0.061, zBar: 0 },
  { wavelength: 670, illuminant: 106.3, xBar: 0.0874, yBar: 0.032, zBar: 0 },
  { wavelength: 680, illuminant: 104.79, xBar: 0.0468, yBar: 0.017, zBar: 0 },
  { wavelength: 690, illuminant: 106.24, xBar: 0.0227, yBar: 0.0082, zBar: 0 },
  { wavelength: 700, illuminant: 107.69, xBar: 0.0114, yBar: 0.0041, zBar: 0 },
];

const dataByWavelength = new Map(SPECTRAL_DATA.map((row) => [row.wavelength, row]));
const MIN_SUPPORTED_ROWS = Math.ceil(SPECTRAL_DATA.length * 0.8);
const MIN_SOURCE_SAMPLES = Math.ceil(SPECTRAL_DATA.length * 0.5);

const clampReflectance = (value: number) => Math.min(1, Math.max(0, value));

const normalizeReflectanceScale = (samples: SpectralSample[]) => {
  const finiteValues = samples.map((sample) => sample.value).filter(Number.isFinite);
  const maxValue = Math.max(...finiteValues);
  const scale = maxValue > 1 && maxValue <= 100 ? 100 : 1;

  return samples.map((sample) => ({
    wavelength: sample.wavelength,
    value: sample.value / scale,
  }));
};

const interpolateReflectance = (samples: SpectralSample[], wavelength: number): number | null => {
  const exact = samples.find((sample) => sample.wavelength === wavelength);
  if (exact) {
    return exact.value;
  }

  let lower: SpectralSample | null = null;
  let upper: SpectralSample | null = null;

  for (const sample of samples) {
    if (sample.wavelength < wavelength && (!lower || sample.wavelength > lower.wavelength)) {
      lower = sample;
    }
    if (sample.wavelength > wavelength && (!upper || sample.wavelength < upper.wavelength)) {
      upper = sample;
    }
  }

  if (!lower || !upper) {
    return null;
  }

  const span = upper.wavelength - lower.wavelength;
  if (span <= 0) {
    return null;
  }

  const ratio = (wavelength - lower.wavelength) / span;
  return lower.value + (upper.value - lower.value) * ratio;
};

export function spectralReflectanceToLab(samples: SpectralSample[]): LabColor | null {
  const normalizedSamples = normalizeReflectanceScale(
    samples
      .filter((sample) => Number.isFinite(sample.wavelength) && Number.isFinite(sample.value))
      .sort((left, right) => left.wavelength - right.wavelength),
  );
  const supportedSourceWavelengths = new Set(
    normalizedSamples
      .map((sample) => Math.round(sample.wavelength))
      .filter((wavelength) => wavelength >= SPECTRAL_DATA[0].wavelength && wavelength <= SPECTRAL_DATA.at(-1)!.wavelength),
  );

  if (supportedSourceWavelengths.size < MIN_SOURCE_SAMPLES) {
    return null;
  }

  let x = 0;
  let y = 0;
  let z = 0;
  let whiteX = 0;
  let whiteY = 0;
  let whiteZ = 0;
  let used = 0;

  for (const row of SPECTRAL_DATA) {
    const reflectance = interpolateReflectance(normalizedSamples, row.wavelength);
    if (reflectance === null) {
      continue;
    }

    const weightedX = row.illuminant * row.xBar;
    const weightedY = row.illuminant * row.yBar;
    const weightedZ = row.illuminant * row.zBar;

    x += clampReflectance(reflectance) * weightedX;
    y += clampReflectance(reflectance) * weightedY;
    z += clampReflectance(reflectance) * weightedZ;
    whiteX += weightedX;
    whiteY += weightedY;
    whiteZ += weightedZ;
    used += 1;
  }

  if (used < MIN_SUPPORTED_ROWS || whiteX === 0 || whiteY === 0 || whiteZ === 0) {
    return null;
  }

  return xyzToLab({
    x: (x / whiteX) * D50_WHITE.x,
    y: (y / whiteY) * D50_WHITE.y,
    z: (z / whiteZ) * D50_WHITE.z,
  });
}

export function hasSupportedSpectralWavelength(wavelength: number): boolean {
  return dataByWavelength.has(Math.round(wavelength));
}
