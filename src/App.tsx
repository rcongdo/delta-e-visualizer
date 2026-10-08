import { useEffect, useMemo, useRef, useState } from "react";
import { findClosestMatches } from "./color/closestMatches";
import { deltaE } from "./color/deltaE";
import { parseCxf } from "./cxf/parseCxf";
import ColorList from "./components/ColorList";
import CxfImportButton from "./components/CxfImportButton";
import ControlsPanel from "./components/ControlsPanel";
import GamutPanel, { type PointColorMode } from "./components/GamutPanel";
import LabScene from "./components/LabScene";
import { GAMUT_STATUS_COLORS, computeGamutResults, countGamutStatuses } from "./gamut/classify";
import { useGamutProfile } from "./gamut/useGamutProfile";
import type { DeltaEFormula, ImportResult, LabColor } from "./types";

const emptyImportResult: ImportResult = { colors: [], unresolved: [], errors: [] };
const devFixtureStorageKey = "__labVisualizerCxf";
const devFixtureHashPrefix = "#cxf=";

export default function App() {
  const [importResult, setImportResult] = useState<ImportResult>({ colors: [], unresolved: [], errors: [] });
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formula, setFormula] = useState<DeltaEFormula>("ciede2000");
  const [tolerance, setTolerance] = useState(2);
  const [manualLabInputs, setManualLabInputs] = useState({ l: "", a: "", b: "" });
  const [showShell, setShowShell] = useState(true);
  const [pointMode, setPointMode] = useState<PointColorMode>("actual");
  const uploadSequenceRef = useRef(0);
  const gamut = useGamutProfile(importResult.colors);

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
  const closestMatches = useMemo(
    () => (manualLab && importResult.colors.length > 0 ? findClosestMatches(importResult.colors, manualLab, formula, 3) : null),
    [formula, importResult.colors, manualLab],
  );
  const gamutResults = useMemo(
    () =>
      gamut.reproductions ? computeGamutResults(importResult.colors, gamut.reproductions, formula, tolerance) : null,
    [formula, gamut.reproductions, importResult.colors, tolerance],
  );
  const gamutCounts = useMemo(() => (gamutResults ? countGamutStatuses(gamutResults) : null), [gamutResults]);
  const pointColors = useMemo(
    () =>
      pointMode === "gamut" && gamutResults
        ? new Map([...gamutResults].map(([id, result]) => [id, GAMUT_STATUS_COLORS[result.status]]))
        : null,
    [gamutResults, pointMode],
  );
  const importError =
    importResult.colors.length === 0 && importResult.errors.length > 0 ? importResult.errors.join(" ") : null;
  const selectedGamut = (selectedId && gamutResults?.get(selectedId)) || null;

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
      setImportFileName(null);
      setSelectedId(null);
      return;
    }

    try {
      const text = await file.text();
      if (uploadSequence !== uploadSequenceRef.current) {
        return;
      }
      applyImportedText(text);
      setImportFileName(file.name);
    } catch (error) {
      if (uploadSequence !== uploadSequenceRef.current) {
        return;
      }
      setImportResult({
        colors: [],
        unresolved: [],
        errors: [error instanceof Error ? error.message : "Unable to read file"],
      });
      setImportFileName(null);
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
          pointColors={pointColors}
          shell={gamut.shell}
          showShell={showShell}
          reproducedLab={selectedGamut?.reproducedLab ?? null}
          onSelect={setSelectedId}
        />
        <div className="scene-toolbar">
          <CxfImportButton fileName={importFileName} error={importError} onFileUpload={handleFileUpload} />
          <GamutPanel
            selection={gamut.selection}
            pendingSelection={gamut.pendingSelection}
            error={gamut.error}
            info={gamut.info}
            counts={gamutCounts}
            showShell={showShell}
            pointMode={pointMode}
            onSelectPreset={gamut.selectPreset}
            onUploadProfile={gamut.uploadProfile}
            onShowShellChange={setShowShell}
            onPointModeChange={setPointMode}
          />
        </div>
      </section>
      <aside className="tool-panel" aria-label="Color standard controls">
        <ControlsPanel
          selectedColor={selectedColor}
          formula={formula}
          tolerance={tolerance}
          manualLabInputs={manualLabInputs}
          comparisonResult={comparisonResult}
          closestMatches={closestMatches}
          selectedGamut={selectedGamut}
          deviceChannelNames={gamut.info?.channelNames ?? null}
          onFormulaChange={setFormula}
          onManualLabChange={setManualLabInputs}
          onSelectColor={setSelectedId}
          onToleranceChange={setTolerance}
        />
        <ColorList
          colors={importResult.colors}
          selectedId={selectedId}
          gamutResults={gamutResults}
          onSelect={setSelectedId}
        />
      </aside>
    </main>
  );
}
