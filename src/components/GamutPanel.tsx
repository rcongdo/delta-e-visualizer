import { Upload } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { GAMUT_STATUS_COLORS, GAMUT_STATUS_LABELS } from "../gamut/classify";
import { IN_GAMUT_CUTOFF } from "../gamut/cutoff";
import { GAMUT_PRESETS } from "../gamut/presets";
import type { GamutStatus, ProfileInfo } from "../gamut/types";
import type { GamutSelection } from "../gamut/useGamutProfile";

export type PointColorMode = "actual" | "gamut";

type GamutPanelProps = {
  selection: GamutSelection;
  pendingSelection: GamutSelection | null;
  error: string | null;
  info: ProfileInfo | null;
  counts: Record<GamutStatus, number> | null;
  showShell: boolean;
  pointMode: PointColorMode;
  onSelectPreset: (presetId: string | null) => void;
  onUploadProfile: (file: File) => void;
  onShowShellChange: (show: boolean) => void;
  onPointModeChange: (mode: PointColorMode) => void;
};

const NONE_VALUE = "none";
const UPLOAD_VALUE = "__upload__";
const UPLOADED_VALUE = "__uploaded__";
const statusOrder: GamutStatus[] = ["in", "within", "out"];
const cutoffText = IN_GAMUT_CUTOFF.toFixed(1);
const legendHelp =
  `Achievable ΔE compares each color with its absolute-colorimetric round trip through the profile. ` +
  `Green: ≤ ${cutoffText} (in gamut). Amber: above ${cutoffText} but within tolerance. Red: above tolerance.`;

const selectionValue = (selection: GamutSelection) =>
  selection.kind === "none" ? NONE_VALUE : selection.kind === "preset" ? selection.presetId : UPLOADED_VALUE;

export default function GamutPanel({
  selection,
  pendingSelection,
  error,
  info,
  counts,
  showShell,
  pointMode,
  onSelectPreset,
  onUploadProfile,
  onShowShellChange,
  onPointModeChange,
}: GamutPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shown = pendingSelection ?? selection;
  const loading = pendingSelection !== null;

  const handleSelect = (value: string) => {
    if (value === UPLOAD_VALUE) {
      fileInputRef.current?.click();
    } else if (value === NONE_VALUE) {
      onSelectPreset(null);
    } else if (value !== UPLOADED_VALUE) {
      onSelectPreset(value);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      onUploadProfile(file);
    }
  };

  return (
    <div className="gamut-bar" role="group" aria-labelledby="gamut-heading">
      <label className="gamut-select">
        <span id="gamut-heading">Gamut</span>
        <select value={selectionValue(shown)} onChange={(event) => handleSelect(event.currentTarget.value)}>
          <option value={NONE_VALUE}>None</option>
          {GAMUT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          {shown.kind === "upload" && <option value={UPLOADED_VALUE}>{shown.fileName}</option>}
          <option value={UPLOAD_VALUE}>Upload ICC…</option>
        </select>
      </label>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".icc,.icm,application/vnd.iccprofile"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      {loading && <span className="profile-meta">Loading profile…</span>}
      {!loading && info && (
        <span className="profile-meta" title={`${info.name} · ${info.colorSpace}`}>
          {selection.kind === "upload" && <Upload aria-hidden="true" size={12} />}
          <strong>{info.name}</strong>
          <span>{info.colorSpace}</span>
        </span>
      )}
      {error && <span className="gamut-error">{error}</span>}

      {info && (
        <>
          <div className="gamut-legend" title={legendHelp}>
            {statusOrder.map((status) => (
              <span key={status}>
                <i className="status-dot" style={{ background: GAMUT_STATUS_COLORS[status] }} />
                {GAMUT_STATUS_LABELS[status]}
                <strong>{counts ? counts[status] : "–"}</strong>
              </span>
            ))}
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={showShell}
              onChange={(event) => onShowShellChange(event.currentTarget.checked)}
            />
            <span>Shell</span>
          </label>
          <div className="segmented" role="group" aria-label="Point color">
            {(["actual", "gamut"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={pointMode === mode ? "is-active" : ""}
                aria-pressed={pointMode === mode}
                onClick={() => onPointModeChange(mode)}
              >
                {mode === "actual" ? "Actual color" : "Gamut warning"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
