# ICC Gamut Check Design

## Goal

Let the user pick an ICC output profile — one of the bundled CRPC1–7 presets or an uploaded `.icc` — and see how well each CxF color can be reproduced on it. The profile's gamut is drawn in the existing 3D Lab scene, each color gets an "achievable Delta E", points can be colored by gamut status, and the color list can be sorted and filtered by that result.

## Scope

- Everything stays browser-only. Uploaded profiles are not sent anywhere and are not persisted across reloads.
- Out of scope: device links, abstract and named-color profiles; choosing a rendering intent; correcting M0/M1 measurement-condition differences between CxF data and the profile.

## Profiles

### Presets

The seven ISO 15339 / CGATS 21-2 reference profiles are bundled unmodified in `public/profiles/` and fetched only when selected. Their copyright tag permits redistribution unaltered.

| Preset | File | Label |
| --- | --- | --- |
| CRPC1 | `CGATS21_CRPC1.icc` | CRPC1 · Coldset News |
| CRPC2 | `CGATS21_CRPC2.icc` | CRPC2 · Heatset News |
| CRPC3 | `CGATS21_CRPC3.icc` | CRPC3 · Premium Uncoated |
| CRPC4 | `CGATS21_CRPC4.icc` | CRPC4 · Supercal |
| CRPC5 | `CGATS21_CRPC5.icc` | CRPC5 · Pub Coated |
| CRPC6 | `GRACoL2013_CRPC6.icc` | CRPC6 · Premium Coated |
| CRPC7 | `CGATS21_CRPC7.icc` | CRPC7 · Extra Large |

Sources: CRPC1–5 and CRPC7 from `/Library/Application Support/Adobe/Color/Profiles/Recommended/`; CRPC6 from the same folder (`GRACoL2013_CRPC6.icc`).

### Uploads

Accept any `.icc`/`.icm` that LittleCMS can open and build both a Lab → device and device → Lab transform for, using absolute colorimetric intent. This covers CMYK, RGB, and n-color (e.g. 7CLR ECG) output profiles. Anything else shows an error and leaves the previous profile active.

## Color Engine

Use `lcms-wasm` (LittleCMS compiled to WebAssembly, MIT). It runs inside a dedicated Web Worker so profile loading and shell building never block the UI.

Verify early that `lcms-wasm` loads in a Vite module worker in both `npm run dev` and the production build served from the GitHub Pages subpath, and in Vitest under Node. If it cannot, stop and revisit the engine choice before building on it.

### Round-trip

For each target Lab color:

1. Lab (D50, absolute) → device values via the profile with **absolute colorimetric** intent.
2. Device values → Lab via the profile with absolute colorimetric intent.
3. The result is the **reproduced Lab**; the device values from step 1 are the **predicted device values**.

### Worker API

- `loadProfile(bytes)` → `{ name, colorSpace, channelNames, shell }` or an error message.
- `roundTrip(labs)` → per color `{ reproducedLab, deviceValues }` for the currently loaded profile.

Each request carries a sequence id; responses for superseded requests are ignored by the caller (same pattern as the existing CxF upload sequence ref).

## Classification

Pure function on the main thread:

`achievableDeltaE = deltaE(selectedFormula, reproducedLab, targetLab)`

Rules are checked in this order:

| Status | Rule | Color |
| --- | --- | --- |
| Out of tolerance | `achievableDeltaE > tolerance` | red |
| In gamut | `achievableDeltaE <= IN_GAMUT_CUTOFF` | green |
| Within tolerance | otherwise | amber |

Out of tolerance wins, so a color is never green while failing the tolerance. If `tolerance <= IN_GAMUT_CUTOFF`, nothing is amber.

Changing the formula or tolerance re-runs classification only. Changing the profile or the CxF file re-runs the round-trip.

### In-gamut cutoff

`IN_GAMUT_CUTOFF = 1.0` (CIEDE2000), a fixed constant. The UI explains it in a tooltip; it is not user-editable.

How it was chosen (measured 2026-10-01 with LittleCMS 2.16 via `lcms-wasm`): CMYK grids (levels 0/10/25/40/55/70/85/100, TAC ≤ 240%, 3,155 patches) were converted to Lab through each preset's A2B, then round-tripped with absolute colorimetric intent. Even though every patch is printable, round-trip error is not near zero — mostly in K-bearing shadows, where the profiles' B2A black generation differs from their A2B (e.g. CRPC3 0/100/0/100 returns as 51/74/50/80, ΔE00 3.7). Share of patches at or below each cutoff:

| Preset | ≤ 0.5 | ≤ 1.0 | ≤ 1.5 | p99 |
| --- | --- | --- | --- | --- |
| CRPC1 | 51% | 81% | 96% | 1.74 |
| CRPC2 | 69% | 89% | 96% | 2.12 |
| CRPC3 | 58% | 81% | 90% | 3.23 |
| CRPC4 | 84% | 96% | 99% | 1.42 |
| CRPC5 | 87% | 97% | 100% | 1.17 |
| CRPC6 | 85% | 96% | 99% | 1.55 |
| CRPC7 | 89% | 98% | 99% | 1.30 |

A 99th-percentile rule (≈ 2.1) would exceed the default tolerance of 2 and hide the amber state. 1.0 keeps most printable colors green and shows printable-but-imperfect colors as amber ("reachable within tolerance, not exactly"). Nothing within tolerance is ever red, so the cutoff cannot cause a false failure.

Record this summary in a comment beside the constant.

## Gamut Shell

Built in the worker on profile load:

1. Sample a Lab grid: L* 0–100, a* and b* −128–128, at about 2-unit spacing.
2. Round-trip every grid point; the scalar field value is the CIE76 distance between input and reproduced Lab.
3. Extract the isosurface at `IN_GAMUT_CUTOFF` with marching cubes.
4. Return positions as Lab vertices plus triangle indices.

The shell is the same "reproducible" region the round-trip measures, so the drawn boundary and the green points agree. It does not depend on the profile's `gbd` tags, so uploads without them work too. The field uses CIE76 so the shell does not change shape when the user switches Delta E formula.

## UI

### Gamut Profile section (new, below Tolerance)

- Profile select: None, CRPC1–7 (labels above), "Upload ICC…" (opens a file picker).
- Loaded profile name and color space; loading and error states.
- Status counts: in gamut / within tolerance / out of tolerance.
- "Show gamut shell" checkbox (default on).
- Point color toggle: "Actual color" / "Gamut warning" (default "Actual color").

### 3D scene

- Shell: translucent mesh with vertex colors from each vertex's Lab, depth-write off so points stay visible.
- Gamut warning mode: points use status colors instead of their own color.
- Selected color, when a profile is loaded: a thin line from the target to its reproduced Lab, with a small marker at the reproduced Lab.

### Selected Color

When a profile is loaded, add: achievable Delta E (selected formula), status, and predicted device values labeled by channel (e.g. `C 12 M 87 Y 0 K 3`).

### Color list

- Each row shows an achievable-Delta-E badge in its status color.
- Sort select: Name, Achievable ΔE, L*, Chroma, Hue; plus an ascending/descending toggle. Default: Name ascending.
- Status filter chips: All, In gamut, Within tol, Out. They combine with the existing text search.
- With no profile selected, the badge, the Achievable ΔE sort option, and the status chips are hidden; if Achievable ΔE was the active sort, fall back to Name.

## Error Handling

- WASM engine fails to load: show an error in the Gamut Profile section; the rest of the app keeps working.
- Preset fetch fails: show an error; keep the previous profile.
- Invalid or unsupported upload: show the reason; keep the previous profile.
- A profile is selected while an earlier one is still loading: the earlier result is discarded.

## Testing

Vitest, with LittleCMS running in Node against the bundled presets:

- A Lab color produced from a CMYK value through the device → Lab transform round-trips below `IN_GAMUT_CUTOFF` on CRPC6.
- Lab 50 / 100 / 0 on CRPC1 classifies as out of tolerance at tolerance 2.
- CRPC6 paper white (CMYK 0/0/0/0 → Lab) is approximately 95 / 1 / −4.
- Classification boundaries: exactly at the cutoff, exactly at the tolerance, tolerance below the cutoff.
- Sort and filter: each sort key in both directions; status chips combined with text search; fallback when the profile is cleared.
- Gamut shell for CRPC6 is non-empty and closed (every edge shared by exactly two triangles).
