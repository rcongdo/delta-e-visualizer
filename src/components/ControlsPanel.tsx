import { Check, X } from "lucide-react";
import { GAMUT_STATUS_COLORS, GAMUT_STATUS_LABELS } from "../gamut/classify";
import type { ColorMatch } from "../color/closestMatches";
import { formatDeviceValues } from "../gamut/format";
import type { GamutResult } from "../gamut/types";
import type { DeltaEFormula, ResolvedColor } from "../types";

type ControlsPanelProps = {
  selectedColor: ResolvedColor | null;
  formula: DeltaEFormula;
  tolerance: number;
  manualLabInputs: { l: string; a: string; b: string };
  comparisonResult: { value: number; inTolerance: boolean } | null;
  closestMatches: ColorMatch[] | null;
  selectedGamut: GamutResult | null;
  deviceChannelNames: string[] | null;
  onFormulaChange: (formula: DeltaEFormula) => void;
  onManualLabChange: (inputs: { l: string; a: string; b: string }) => void;
  onToleranceChange: (tolerance: number) => void;
  onSelectColor: (id: string) => void;
};

const formulaOptions: Array<{ value: DeltaEFormula; label: string }> = [
  { value: "cie76", label: "CIE76" },
  { value: "cie94", label: "CIE94" },
  { value: "ciede2000", label: "CIEDE2000" },
  { value: "cmc", label: "CMC" },
];

const formatLab = (value: number) => value.toFixed(2);

export default function ControlsPanel({
  selectedColor,
  formula,
  tolerance,
  manualLabInputs,
  comparisonResult,
  closestMatches,
  selectedGamut,
  deviceChannelNames,
  onFormulaChange,
  onManualLabChange,
  onToleranceChange,
  onSelectColor,
}: ControlsPanelProps) {
  return (
    <>
      <header className="panel-header">
        <p className="eyebrow">Browser-only workspace</p>
        <h1>Lab Visualizer</h1>
      </header>

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
              {selectedColor.path && (
                <div className="detail-wide">
                  <dt>Path</dt>
                  <dd>{selectedColor.path}</dd>
                </div>
              )}
            </dl>
            {selectedGamut && (
              <div className="gamut-detail">
                <i className="status-dot" style={{ background: GAMUT_STATUS_COLORS[selectedGamut.status] }} />
                <strong>Achievable ΔE {selectedGamut.achievableDeltaE.toFixed(2)}</strong>
                <span>{GAMUT_STATUS_LABELS[selectedGamut.status]}</span>
                {deviceChannelNames && (
                  <small>{formatDeviceValues(deviceChannelNames, selectedGamut.deviceValues)}</small>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="muted">Import a CxF file and select a resolved color.</p>
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
        {closestMatches && closestMatches.length > 0 && (
          <div className="closest-matches">
            <h3 id="closest-matches-heading">Closest Matches</h3>
            <ol aria-labelledby="closest-matches-heading">
              {closestMatches.map((match, index) => {
                const inTolerance = match.deltaE <= tolerance;
                const isSelected = match.color.id === selectedColor?.id;
                return (
                  <li key={match.color.id}>
                    <button
                      type="button"
                      className={`match-row${isSelected ? " is-selected" : ""}`}
                      aria-pressed={isSelected}
                      title={`L* ${formatLab(match.color.lab.l)}  a* ${formatLab(match.color.lab.a)}  b* ${formatLab(
                        match.color.lab.b,
                      )}`}
                      onClick={() => onSelectColor(match.color.id)}
                    >
                      <span className="match-rank">{index + 1}</span>
                      <span className="color-swatch" style={{ background: match.color.displayRgb }} />
                      <strong>{match.color.name}</strong>
                      <span className={`match-delta${inTolerance ? " is-pass" : " is-fail"}`}>
                        ΔE {match.deltaE.toFixed(2)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
    </>
  );
}
