# Lab Color Space Visualizer

A browser-only 3D CIELAB color space visualizer for CxF color standard files.

Live demo: https://rcongdo.github.io/delta-e-visualizer/

## What It Does

- Upload a `.cxf` file locally in the browser.
- Parse direct CIELAB values, with spectral reflectance fallback when enough data is available.
- Plot colors in 3D Lab space.
- Select a standard color from the plot or list.
- Visualize Delta E tolerance around the selected color.
- Compare manual Lab values against the selected standard.
- Check how well each color can be printed with an ICC output profile:
  - Pick an ISO 15339 CRPC1–7 preset or upload your own `.icc` (CMYK, RGB, or n-color).
  - See the profile's gamut drawn as a shell in Lab space.
  - See each color's **achievable Delta E**: the difference between the color and what the profile actually reproduces after converting Lab → device values → Lab with absolute colorimetric intent (LittleCMS). The predicted device values are shown for the selected color.
  - Color points and list badges green (achievable ΔE ≤ 1.0), amber (above 1.0 but within tolerance), or red (above tolerance). A toggle switches points between their actual color and this gamut warning.
  - Sort colors by name, achievable ΔE, L*, chroma, or hue, and filter them by gamut status.

## Gamut Checking Notes

- The 1.0 "in gamut" cutoff was measured, not picked arbitrarily. Even printable CMYK colors come back from an ICC round trip with some error, mostly in the shadows. That's where a profile's Lab → CMYK tables choose different black generation than its CMYK → Lab tables. Colors reproduced within tolerance but not exactly show amber. See `src/gamut/cutoff.ts` for the per-preset numbers.
- The gamut shell is drawn where round-trip error equals the cutoff, then smoothed to remove grid stair-stepping, so it matches the green points to within about one ΔE. Where round-trip error hovers right around the cutoff, the shell can still show small specks or a ragged edge.

## Bundled Profiles

`public/profiles/` contains the CGATS 21-2 / ISO 15339 CRPC1–7 characterization profiles, unmodified (CRPC6 is `GRACoL2013_CRPC6.icc`). Each one is downloaded only when selected. Their copyright notice says IDEAlliance makes them available with X-Rite's permission, and that they may be shared without restriction but not altered.

## Delta E Support

- CIE76
- CIE94
- CIEDE2000
- CMC l:c

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

## Privacy

CxF files and ICC profiles are processed entirely in the browser. The app does not upload files to a server.
