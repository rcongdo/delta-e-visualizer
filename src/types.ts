export type LabColor = {
  l: number;
  a: number;
  b: number;
};

export type ResolvedColor = {
  id: string;
  name: string;
  lab: LabColor;
  displayRgb: string;
  source: "lab" | "spectral";
  path?: string;
};

export type UnresolvedColor = {
  name: string;
  reason: string;
  path?: string;
};

export type ImportResult = {
  colors: ResolvedColor[];
  unresolved: UnresolvedColor[];
  errors: string[];
};

export type DeltaEFormula = "cie76" | "cie94" | "ciede2000" | "cmc";
