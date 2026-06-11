import { useEffect, useMemo, useRef, useState } from "react";
import { deltaE } from "./color/deltaE";
import { parseCxf } from "./cxf/parseCxf";
import ColorList from "./components/ColorList";
import ControlsPanel from "./components/ControlsPanel";
import LabScene from "./components/LabScene";
import type { DeltaEFormula, ImportResult, LabColor } from "./types";

const emptyImportResult: ImportResult = { colors: [], unresolved: [], errors: [] };
const devFixtureStorageKey = "__labVisualizerCxf";
const devFixtureHashPrefix = "#cxf=";

export default function App() {
  const [importResult, setImportResult] = useState<ImportResult>({ colors: [], unresolved: [], errors: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formula, setFormula] = useState<DeltaEFormula>("ciede2000");
  const [tolerance, setTolerance] = useState(2);
  const [manualLabInputs, setManualLabInputs] = useState({ l: "", a: "", b: "" });
  const uploadSequenceRef = useRef(0);

  const selectedColor = useMemo(
    () => importResult.colors.find((color) => color.id === selectedId) ?? null,
    [importResult.colors, selectedId],
  );
  const manualLab = useMemo<LabColor | null>(() => {
    const lab = {
      l: Number(manualLabInputs.l),
      a: Number(manualLabInputs.a),
      b: Number(manualLabInputs.b),
    };

    return Object.values(manualLabInputs).every((value) => value.trim() !== "") &&
      Number.isFinite(lab.l) &&
      Number.isFinite(lab.a) &&
      Number.isFinite(lab.b)
      ? lab
      : null;
  }, [manualLabInputs]);
  const comparisonResult = useMemo(() => {
    if (!selectedColor || !manualLab) {
      return null;
    }

    const value = deltaE(formula, manualLab, selectedColor.lab);
    return {
      value,
      inTolerance: value <= tolerance,
    };
  }, [formula, manualLab, selectedColor, tolerance]);

  const applyImportedText = (text: string) => {
    const result = parseCxf(text);
    setImportResult(result);
    setSelectedId(result.colors[0]?.id ?? null);
  };

  useEffect(() => {
    if (window.location.hash.startsWith(devFixtureHashPrefix)) {
      try {
        applyImportedText(decodeURIComponent(window.location.hash.slice(devFixtureHashPrefix.length)));
      } catch {
        setImportResult({ colors: [], unresolved: [], errors: ["Unable to decode CxF data from the URL fragment."] });
      }
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__loadLabVisualizerCxf = applyImportedText;
    const storedFixture = window.localStorage.getItem(devFixtureStorageKey);
    if (storedFixture) {
      window.localStorage.removeItem(devFixtureStorageKey);
      applyImportedText(storedFixture);
    }
    return () => {
      delete window.__loadLabVisualizerCxf;
    };
  }, []);

  const handleFileUpload = async (file: File | null) => {
    const uploadSequence = uploadSequenceRef.current + 1;
    uploadSequenceRef.current = uploadSequence;

    if (!file) {
      setImportResult(emptyImportResult);
      setSelectedId(null);
      return;
    }

    try {
      const text = await file.text();
      if (uploadSequence !== uploadSequenceRef.current) {
        return;
      }
      applyImportedText(text);
    } catch (error) {
      if (uploadSequence !== uploadSequenceRef.current) {
        return;
      }
      setImportResult({
        colors: [],
        unresolved: [],
        errors: [error instanceof Error ? error.message : "Unable to read file"],
      });
      setSelectedId(null);
    }
  };

  return (
    <main className="app-shell">
      <section className="scene-panel" aria-label="3D Lab color space">
        <LabScene
          colors={importResult.colors}
          comparisonLab={manualLab}
          selectedId={selectedId}
          formula={formula}
          tolerance={tolerance}
          onSelect={setSelectedId}
        />
      </section>
      <aside className="tool-panel" aria-label="Color standard controls">
        <ControlsPanel
          importResult={importResult}
          selectedColor={selectedColor}
          formula={formula}
          tolerance={tolerance}
          manualLabInputs={manualLabInputs}
          comparisonResult={comparisonResult}
          onFileUpload={handleFileUpload}
          onFormulaChange={setFormula}
          onManualLabChange={setManualLabInputs}
          onToleranceChange={setTolerance}
        />
        <ColorList colors={importResult.colors} selectedId={selectedId} onSelect={setSelectedId} />
      </aside>
    </main>
  );
}
