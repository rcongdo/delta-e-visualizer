import { labToCssRgb } from "../color/lab";
import { spectralReflectanceToLab, type SpectralSample } from "../color/spectral";
import type { ImportResult, LabColor } from "../types";

const COLOR_CONTAINER_TAGS = new Set(["object", "sample", "color", "colorspecification"]);
const PRIMARY_COLOR_TAGS = new Set(["object", "sample", "color"]);
const SPECTRAL_CONTAINER_HINTS = ["spectral", "spectrum", "reflectance"];

const LAB_TAGS = {
  l: new Set(["l", "l*", "ciel", "cie_l", "cie-l", "lightness"]),
  a: new Set(["a", "a*", "ciea", "cie_a", "cie-a"]),
  b: new Set(["b", "b*", "cieb", "cie_b", "cie-b"]),
};

const localName = (element: Element) => element.localName || element.tagName;

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "");

const parseNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getAttribute = (element: Element, names: string[]) => {
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value !== null && value.trim() !== "") {
      return value.trim();
    }
  }

  const wanted = new Set(names.map(normalizeName));
  for (const attribute of Array.from(element.attributes)) {
    if (
      (wanted.has(normalizeName(attribute.name)) || wanted.has(normalizeName(attribute.localName))) &&
      attribute.value.trim() !== ""
    ) {
      return attribute.value.trim();
    }
  }

  return null;
};

const getFirstChildText = (element: Element, names: string[]) => {
  const wanted = new Set(names.map(normalizeName));
  for (const child of Array.from(element.children)) {
    if (wanted.has(normalizeName(localName(child))) && child.textContent?.trim()) {
      return child.textContent.trim();
    }
  }

  return null;
};

const getElementName = (element: Element, index: number) =>
  getAttribute(element, ["Name", "name"]) ??
  getFirstChildText(element, ["Name", "name"]) ??
  getAttribute(element, ["ID", "id"]) ??
  getFirstChildText(element, ["ID", "id"]) ??
  `${localName(element)} ${index + 1}`;

const getElementId = (element: Element, index: number, name: string) => {
  const explicitId = getAttribute(element, ["ID", "Id", "id", "Name", "name"]);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return explicitId ?? (slug || `color-${index + 1}`);
};

const getPath = (element: Element, id: string) => `${localName(element)}[${id}]`;

const hasAncestorWithTag = (element: Element, tags: Set<string>) => {
  let parent = element.parentElement;

  while (parent) {
    if (tags.has(normalizeName(localName(parent)))) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
};

const getCandidateElements = (document: Document) => {
  const primaryCandidates = Array.from(document.querySelectorAll("*")).filter((element) => {
    const tag = normalizeName(localName(element));
    return PRIMARY_COLOR_TAGS.has(tag) && !hasAncestorWithTag(element, PRIMARY_COLOR_TAGS) && !isSpectralPoint(element);
  });

  const candidates = primaryCandidates.flatMap((element) => {
    const nestedColorNodes = Array.from(element.querySelectorAll("*")).filter((child) => {
      const tag = normalizeName(localName(child));
      return COLOR_CONTAINER_TAGS.has(tag) && !isSpectralPoint(child) && hasUsableColorData(child);
    });

    return nestedColorNodes.length > 1 ? nestedColorNodes : [element];
  });

  if (candidates.length > 0) {
    return candidates;
  }

  const standaloneSpecs = Array.from(document.querySelectorAll("*")).filter((element) => {
    const tag = normalizeName(localName(element));
    return tag === "colorspecification" && !hasAncestorWithTag(element, COLOR_CONTAINER_TAGS);
  });

  return standaloneSpecs.length > 0 ? standaloneSpecs : [document.documentElement].filter(Boolean);
};

const readLabCandidate = (element: Element): Partial<LabColor> => {
  const lab: Partial<LabColor> = {};
  const allElements = [element, ...Array.from(element.querySelectorAll("*"))];

  for (const current of allElements) {
    for (const attr of Array.from(current.attributes)) {
      const attrName = normalizeName(attr.name);
      const value = parseNumber(attr.value);
      if (value === null) {
        continue;
      }

      if (LAB_TAGS.l.has(attrName)) lab.l = value;
      if (LAB_TAGS.a.has(attrName)) lab.a = value;
      if (LAB_TAGS.b.has(attrName)) lab.b = value;
    }

    const tag = normalizeName(localName(current));
    const value = parseNumber(current.textContent);
    if (value === null) {
      continue;
    }

    if (LAB_TAGS.l.has(tag)) lab.l = value;
    if (LAB_TAGS.a.has(tag)) lab.a = value;
    if (LAB_TAGS.b.has(tag)) lab.b = value;
  }

  return lab;
};

const getExplicitLab = (element: Element): LabColor | null => {
  const lab = readLabCandidate(element);

  if (lab.l === undefined || lab.a === undefined || lab.b === undefined) {
    return null;
  }

  return { l: lab.l, a: lab.a, b: lab.b };
};

const isSpectralContainer = (element: Element) => {
  const tag = normalizeName(localName(element));
  return SPECTRAL_CONTAINER_HINTS.some((hint) => tag.includes(hint));
};

function isSpectralPoint(element: Element) {
  return (
    getAttribute(element, ["wavelength", "Wavelength", "lambda", "Lambda", "nm", "NM"]) !== null &&
    getAttribute(element, ["value", "Value", "reflectance", "Reflectance", "r", "R"]) !== null
  );
}

const readSpectralPoint = (element: Element): SpectralSample | null => {
  const wavelength = parseNumber(
    getAttribute(element, ["wavelength", "Wavelength", "lambda", "Lambda", "nm", "NM"]) ??
      getFirstChildText(element, ["wavelength", "Wavelength", "lambda", "Lambda", "nm", "NM"]),
  );
  const value = parseNumber(
    getAttribute(element, ["value", "Value", "reflectance", "Reflectance", "r", "R"]) ??
      getFirstChildText(element, ["value", "Value", "reflectance", "Reflectance", "r", "R"]),
  );

  if (wavelength === null || value === null) {
    return null;
  }

  return { wavelength, value };
};

const parseNumberArray = (value: string | null | undefined) => {
  if (!value) {
    return [];
  }

  return value
    .trim()
    .split(/[\s,;]+/)
    .map((part) => Number(part))
    .filter(Number.isFinite);
};

const getSpectralArrayMetadata = (element: Element) => {
  const start = parseNumber(
    getAttribute(element, [
      "StartWL",
      "startWL",
      "startWavelength",
      "StartWavelength",
      "start wavelength",
      "wavelengthStart",
      "WavelengthStart",
      "start",
      "Start",
    ]),
  );
  const interval =
    parseNumber(
      getAttribute(element, [
        "Increment",
        "increment",
        "Interval",
        "interval",
        "Step",
        "step",
        "wavelengthIncrement",
        "WavelengthIncrement",
      ]),
    ) ?? 10;

  if (start === null || interval <= 0) {
    return null;
  }

  return { start, interval };
};

const readSpectralArray = (element: Element): SpectralSample[] => {
  const metadata = getSpectralArrayMetadata(element);
  if (!metadata) {
    return [];
  }

  const directValues = parseNumberArray(Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent);
  const nestedValues = Array.from(element.children)
    .filter((child) => ["values", "value", "reflectance", "reflectancevalues"].includes(normalizeName(localName(child))))
    .flatMap((child) => parseNumberArray(child.textContent));
  const values = directValues.length > 1 ? directValues : nestedValues;

  return values.map((value, index) => ({
    wavelength: metadata.start + index * metadata.interval,
    value,
  }));
};

const readSpectralContainerPairs = (element: Element): SpectralSample[] => {
  const wavelengths: number[] = [];
  const values: number[] = [];

  for (const child of Array.from(element.querySelectorAll("*"))) {
    const tag = normalizeName(localName(child));
    const value = parseNumber(child.textContent);
    if (value === null) {
      continue;
    }

    if (["wavelength", "lambda", "nm"].includes(tag)) {
      wavelengths.push(value);
    }
    if (["value", "reflectance", "r"].includes(tag)) {
      values.push(value);
    }
  }

  return wavelengths
    .slice(0, values.length)
    .map((wavelength, index) => ({ wavelength, value: values[index] }))
    .filter((sample) => Number.isFinite(sample.wavelength) && Number.isFinite(sample.value));
};

const getSpectralSamples = (element: Element): SpectralSample[] => {
  const samples: SpectralSample[] = [];
  const allElements = [element, ...Array.from(element.querySelectorAll("*"))];

  for (const current of allElements) {
    const point = readSpectralPoint(current);
    if (point) {
      samples.push(point);
    }
  }

  if (samples.length > 0) {
    return samples;
  }

  for (const current of allElements) {
    if (isSpectralContainer(current)) {
      samples.push(...readSpectralArray(current));
      samples.push(...readSpectralContainerPairs(current));
    }
  }

  return samples;
};

function hasUsableColorData(element: Element) {
  return getExplicitLab(element) !== null || getSpectralSamples(element).length > 0;
}

export function parseCxf(input: string): ImportResult {
  const result: ImportResult = { colors: [], unresolved: [], errors: [] };
  const document = new DOMParser().parseFromString(input, "application/xml");

  if (document.querySelector("parsererror")) {
    return {
      colors: [],
      unresolved: [],
      errors: ["Invalid XML"],
    };
  }

  getCandidateElements(document).forEach((element, index) => {
    const name = getElementName(element, index);
    const id = getElementId(element, index, name);
    const path = getPath(element, id);
    const explicitLab = getExplicitLab(element);
    const spectralLab = explicitLab ? null : spectralReflectanceToLab(getSpectralSamples(element));
    const lab = explicitLab ?? spectralLab;

    if (!lab) {
      result.unresolved.push({
        name,
        path,
        reason: "No usable Lab or spectral data found",
      });
      return;
    }

    result.colors.push({
      id,
      name,
      lab,
      displayRgb: labToCssRgb(lab),
      source: explicitLab ? "lab" : "spectral",
      path,
    });
  });

  if (result.colors.length === 0) {
    result.errors.push("No usable colors found");
  }

  return result;
}
