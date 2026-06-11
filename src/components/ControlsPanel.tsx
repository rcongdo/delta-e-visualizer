import { Check, Upload, X } from "lucide-react";
import type { ChangeEvent } from "react";
import type { DeltaEFormula, ImportResult, ResolvedColor } from "../types";

type ControlsPanelProps = {
  importResult: ImportResult;
  selectedColor: ResolvedColor | null;
  formula: DeltaEFormula;
  tolerance: number;
  manualLabInputs: { l: string; a: string; b: string };
  comparisonResult: { value: number; inTolerance: boolean } | null;
  onFileUpload: (file: File | null) => void;
  onFormulaChange: (formula: DeltaEFormula) => void;
  onManualLabChange: (inputs: { l: string; a: string; b: string }) => void;
  onToleranceChange: (tolerance: number) => void;
};

const formulaOptions: Array<{ value: DeltaEFormula; label: string }> = [
  { value: "cie76", label: "CIE76" },
  { value: "cie94", label: "CIE94" },
  { value: "ciede2000", label: "CIEDE2000" },
  { value: "cmc", label: "CMC" },
];

const formatLab = (value: number) => value.toFixed(2);

export default function ControlsPanel({
  importResult,
  selectedColor,
  formula,
  tolerance,
  manualLabInputs,
  comparisonResult,
  onFileUpload,
  onFormulaChange,
  onManualLabChange,
  onToleranceChange,
}: ControlsPanelProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFileUpload(event.currentTarget.files?.[0] ?? null);
  };

  return (
    <>
      <header className="panel-header">
        <p className="eyebrow">Browser-only workspace</p>
        <h1>Lab Visualizer</h1>
      </header>

      <section className="panel-section" aria-labelledby="import-heading">
        <h2 id="import-heading">CxF Import</h2>
        <label className="file-input">
          <Upload aria-hidden="true" size={16} />
          <span>Choose .cxf file</span>
          <input type="file" accept=".cxf,.xml,text/xml,application/xml" onChange={handleFileChange} />
        </label>
        <div className="summary-grid" aria-label="Import summary">
          <span>
            <strong>{importResult.colors.length}</strong>
            Resolved
          </span>
          <span>
            <strong>{importResult.unresolved.length}</strong>
            Unresolved
          </span>
          <span>
            <strong>{importResult.errors.length}</strong>
            Errors
          </span>
        </div>
        {(importResult.unresolved.length > 0 || importResult.errors.length > 0) && (
          <div className="import-issues">
            {importResult.errors.map((error) => (
              <p key={error} className="issue issue-error">
                {error}
              </p>
            ))}
            {importResult.unresolved.map((color) => (
              <p key={`${color.path ?? color.name}-${color.reason}`} className="issue">
                <strong>{color.name}</strong>: {color.reason}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="panel-section" aria-labelledby="tolerance-heading">
        <h2 id="tolerance-heading">Tolerance</h2>
        <div className="tolerance-controls">
          <label className="field">
            <span>Formula</span>
            <select value={formula} onChange={(event) => onFormulaChange(event.currentTarget.value as DeltaEFormula)}>
              {formulaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Delta E</span>
            <input
              min="0"
              step="0.1"
              type="number"
              value={tolerance}
              onChange={(event) => onToleranceChange(Number(event.currentTarget.value) || 0)}
            />
          </label>
        </div>
      </section>

      <section className="panel-section" aria-labelledby="selected-heading">
        <h2 id="selected-heading">Selected Color</h2>
        {selectedColor ? (
          <div className="selected-details">
            <div className="selected-title">
              <span className="color-swatch" style={{ background: selectedColor.displayRgb }} />
              <strong>{selectedColor.name}</strong>
            </div>
            <dl>
              <div>
                <dt>L*</dt>
                <dd>{formatLab(selectedColor.lab.l)}</dd>
              </div>
              <div>
                <dt>a*</dt>
                <dd>{formatLab(selectedColor.lab.a)}</dd>
              </div>
              <div>
                <dt>b*</dt>
                <dd>{formatLab(selectedColor.lab.b)}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{selectedColor.source === "lab" ? "Direct Lab" : "Spectral"}</dd>
              </div>
              {selectedColor.path && (
                <div>
                  <dt>Path</dt>
                  <dd>{selectedColor.path}</dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <p className="muted">Upload a CxF file and select a resolved color.</p>
        )}
      </section>

      <section className="panel-section" aria-labelledby="manual-lab-heading">
        <h2 id="manual-lab-heading">Manual Lab</h2>
        <div className="manual-lab-grid">
          {(["l", "a", "b"] as const).map((channel) => (
            <label key={channel} className="field">
              <span>{channel === "l" ? "L*" : `${channel}*`}</span>
              <input
                type="number"
                step="0.01"
                value={manualLabInputs[channel]}
                onChange={(event) =>
                  onManualLabChange({
                    ...manualLabInputs,
                    [channel]: event.currentTarget.value,
                  })
                }
              />
            </label>
          ))}
        </div>
        <div
          className={`comparison-result${
            comparisonResult ? (comparisonResult.inTolerance ? " is-pass" : " is-fail") : ""
          }`}
        >
          {comparisonResult ? (
            <>
              <span className="comparison-icon" aria-hidden="true">
                {comparisonResult.inTolerance ? <Check size={16} /> : <X size={16} />}
              </span>
              <strong>Delta E {comparisonResult.value.toFixed(2)}</strong>
              <span>{comparisonResult.inTolerance ? "In tolerance" : "Out of tolerance"}</span>
            </>
          ) : (
            <span className="muted">Enter Lab values to compare.</span>
          )}
        </div>
      </section>
    </>
  );
}
