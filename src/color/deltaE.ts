import type { DeltaEFormula, LabColor } from "../types";

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;
const hypot = (...values: number[]) => Math.hypot(...values);

const chroma = (color: LabColor) => hypot(color.a, color.b);

function hueDegrees(a: number, b: number) {
  const hue = radiansToDegrees(Math.atan2(b, a));
  return hue >= 0 ? hue : hue + 360;
}

function deltaECie76(sample: LabColor, standard: LabColor) {
  return hypot(sample.l - standard.l, sample.a - standard.a, sample.b - standard.b);
}

function deltaECie94(sample: LabColor, standard: LabColor) {
  const deltaL = sample.l - standard.l;
  const sampleChroma = chroma(sample);
  const standardChroma = chroma(standard);
  const deltaC = sampleChroma - standardChroma;
  const deltaA = sample.a - standard.a;
  const deltaB = sample.b - standard.b;
  const deltaH = Math.sqrt(Math.max(0, deltaA ** 2 + deltaB ** 2 - deltaC ** 2));

  const sL = 1;
  const sC = 1 + 0.045 * standardChroma;
  const sH = 1 + 0.015 * standardChroma;

  return hypot(deltaL / sL, deltaC / sC, deltaH / sH);
}

function deltaECmc(sample: LabColor, standard: LabColor) {
  const l = 2;
  const c = 1;
  const deltaL = sample.l - standard.l;
  const sampleChroma = chroma(sample);
  const standardChroma = chroma(standard);
  const deltaC = sampleChroma - standardChroma;
  const deltaA = sample.a - standard.a;
  const deltaB = sample.b - standard.b;
  const deltaH = Math.sqrt(Math.max(0, deltaA ** 2 + deltaB ** 2 - deltaC ** 2));
  const standardHue = hueDegrees(standard.a, standard.b);

  const f = Math.sqrt(standardChroma ** 4 / (standardChroma ** 4 + 1900));
  const t =
    standardHue >= 164 && standardHue <= 345
      ? 0.56 + Math.abs(0.2 * Math.cos(degreesToRadians(standardHue + 168)))
      : 0.36 + Math.abs(0.4 * Math.cos(degreesToRadians(standardHue + 35)));
  const sL = standard.l < 16 ? 0.511 : (0.040975 * standard.l) / (1 + 0.01765 * standard.l);
  const sC = (0.0638 * standardChroma) / (1 + 0.0131 * standardChroma) + 0.638;
  const sH = sC * (f * t + 1 - f);

  return hypot(deltaL / (l * sL), deltaC / (c * sC), deltaH / sH);
}

function deltaECiede2000(sample: LabColor, standard: LabColor) {
  const c1 = chroma(sample);
  const c2 = chroma(standard);
  const cMean = (c1 + c2) / 2;
  const cMean7 = cMean ** 7;
  const g = 0.5 * (1 - Math.sqrt(cMean7 / (cMean7 + 25 ** 7)));

  const a1Prime = (1 + g) * sample.a;
  const a2Prime = (1 + g) * standard.a;
  const c1Prime = hypot(a1Prime, sample.b);
  const c2Prime = hypot(a2Prime, standard.b);
  const h1Prime = c1Prime === 0 ? 0 : hueDegrees(a1Prime, sample.b);
  const h2Prime = c2Prime === 0 ? 0 : hueDegrees(a2Prime, standard.b);

  const deltaLPrime = standard.l - sample.l;
  const deltaCPrime = c2Prime - c1Prime;
  let deltaHPrimeDegrees = h2Prime - h1Prime;

  if (c1Prime * c2Prime === 0) {
    deltaHPrimeDegrees = 0;
  } else if (deltaHPrimeDegrees > 180) {
    deltaHPrimeDegrees -= 360;
  } else if (deltaHPrimeDegrees < -180) {
    deltaHPrimeDegrees += 360;
  }

  const deltaHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(degreesToRadians(deltaHPrimeDegrees / 2));

  const lPrimeMean = (sample.l + standard.l) / 2;
  const cPrimeMean = (c1Prime + c2Prime) / 2;
  let hPrimeMean = (h1Prime + h2Prime) / 2;

  if (c1Prime * c2Prime === 0) {
    hPrimeMean = h1Prime + h2Prime;
  } else if (Math.abs(h1Prime - h2Prime) > 180 && h1Prime + h2Prime < 360) {
    hPrimeMean = (h1Prime + h2Prime + 360) / 2;
  } else if (Math.abs(h1Prime - h2Prime) > 180) {
    hPrimeMean = (h1Prime + h2Prime - 360) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos(degreesToRadians(hPrimeMean - 30)) +
    0.24 * Math.cos(degreesToRadians(2 * hPrimeMean)) +
    0.32 * Math.cos(degreesToRadians(3 * hPrimeMean + 6)) -
    0.2 * Math.cos(degreesToRadians(4 * hPrimeMean - 63));
  const deltaTheta = 30 * Math.exp(-(((hPrimeMean - 275) / 25) ** 2));
  const cPrimeMean7 = cPrimeMean ** 7;
  const rC = 2 * Math.sqrt(cPrimeMean7 / (cPrimeMean7 + 25 ** 7));
  const sL = 1 + (0.015 * (lPrimeMean - 50) ** 2) / Math.sqrt(20 + (lPrimeMean - 50) ** 2);
  const sC = 1 + 0.045 * cPrimeMean;
  const sH = 1 + 0.015 * cPrimeMean * t;
  const rT = -Math.sin(degreesToRadians(2 * deltaTheta)) * rC;

  const lTerm = deltaLPrime / sL;
  const cTerm = deltaCPrime / sC;
  const hTerm = deltaHPrime / sH;

  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rT * cTerm * hTerm);
}

export function deltaE(formula: DeltaEFormula, sample: LabColor, standard: LabColor): number {
  switch (formula) {
    case "cie76":
      return deltaECie76(sample, standard);
    case "cie94":
      return deltaECie94(sample, standard);
    case "ciede2000":
      return deltaECiede2000(sample, standard);
    case "cmc":
      return deltaECmc(sample, standard);
  }
}
