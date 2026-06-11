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

CxF files are parsed entirely in the browser. The app does not upload files to a server.
