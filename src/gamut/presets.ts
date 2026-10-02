export type GamutPreset = {
  id: string;
  label: string;
  file: string;
};

export const GAMUT_PRESETS: GamutPreset[] = [
  { id: "crpc1", label: "CRPC1 · Coldset News", file: "CGATS21_CRPC1.icc" },
  { id: "crpc2", label: "CRPC2 · Heatset News", file: "CGATS21_CRPC2.icc" },
  { id: "crpc3", label: "CRPC3 · Premium Uncoated", file: "CGATS21_CRPC3.icc" },
  { id: "crpc4", label: "CRPC4 · Supercal", file: "CGATS21_CRPC4.icc" },
  { id: "crpc5", label: "CRPC5 · Pub Coated", file: "CGATS21_CRPC5.icc" },
  { id: "crpc6", label: "CRPC6 · Premium Coated", file: "GRACoL2013_CRPC6.icc" },
  { id: "crpc7", label: "CRPC7 · Extra Large", file: "CGATS21_CRPC7.icc" },
];

export const findPreset = (id: string) => GAMUT_PRESETS.find((preset) => preset.id === id) ?? null;

export const presetUrl = (preset: GamutPreset) => `${import.meta.env.BASE_URL}profiles/${preset.file}`;
