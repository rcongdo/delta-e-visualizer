# Lab Color Space Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only web app that uploads CxF color standards, plots resolved Lab colors in 3D, and visualizes Delta E tolerance volumes around a selected color.

**Architecture:** Use a Vite + React + TypeScript single-page app. Keep color science, CxF parsing, and tolerance sampling in pure modules with tests, then wire them into a Three.js scene and operational UI.

**Tech Stack:** Vite, React, TypeScript, Three.js, Vitest, Playwright or browser automation for visual verification.

---

## File Structure

- `package.json`: scripts and dependencies for the local app.
- `index.html`: Vite entry point.
- `src/main.tsx`: React mount point.
- `src/App.tsx`: top-level app state and layout.
- `src/styles.css`: app layout and visual styling.
- `src/types.ts`: shared color, parser, and Delta E types.
- `src/color/lab.ts`: Lab/XYZ/sRGB conversion helpers.
- `src/color/deltaE.ts`: CIE76, CIE94, CIEDE2000, and CMC formulas.
- `src/color/spectral.ts`: spectral reflectance to Lab fallback.
- `src/cxf/parseCxf.ts`: browser XML parser and CxF extraction.
- `src/tolerance/surface.ts`: sampled tolerance mesh generation.
- `src/components/LabScene.tsx`: Three.js scene, points, picking, and tolerance mesh.
- `src/components/ControlsPanel.tsx`: upload, formula, tolerance, import summary, selected color details.
- `src/components/ColorList.tsx`: searchable color list.
- `src/test/fixtures/*.cxf`: direct Lab, spectral, and invalid sample files.
- `src/**/*.test.ts`: module tests.

---

## Task 1: Scaffold The Local App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/types.ts`

- [ ] **Step 1: Create project metadata and scripts**

Create `package.json`:

```json
{
  "name": "lab-color-space-visualizer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "three": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@types/three": "latest",
    "vitest": "latest",
    "jsdom": "latest"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 3: Create the app shell**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lab Color Space Visualizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `src/types.ts`:

```ts
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
```

Create a placeholder `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="scene-panel" aria-label="3D Lab color space">
        <div className="empty-scene">Lab Color Space Visualizer</div>
      </section>
      <aside className="tool-panel" aria-label="Color standard controls">
        <h1>Lab Visualizer</h1>
        <p>Upload a CxF file to plot standards in 3D Lab space.</p>
      </aside>
    </main>
  );
}
```

Create `src/styles.css` with stable full-screen layout:

```css
* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  color: #172019;
  background: #f4f1ea;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  height: 100%;
  min-height: 620px;
}

.scene-panel {
  min-width: 0;
  position: relative;
  background: #101512;
}

.empty-scene {
  display: grid;
  height: 100%;
  place-items: center;
  color: #f3f7f0;
  font-size: 24px;
}

.tool-panel {
  overflow: auto;
  border-left: 1px solid #d8d3c8;
  background: #fbfaf7;
  padding: 18px;
}

.tool-panel h1 {
  margin: 0 0 8px;
  font-size: 22px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(420px, 58vh) auto;
  }

  .tool-panel {
    border-left: 0;
    border-top: 1px solid #d8d3c8;
  }
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 5: Verify scaffold**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

---

## Task 2: Implement Color Conversion And Delta E Math

**Files:**
- Create: `src/color/lab.ts`
- Create: `src/color/deltaE.ts`
- Create: `src/color/deltaE.test.ts`

- [ ] **Step 1: Write Delta E tests**

Create `src/color/deltaE.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deltaE } from "./deltaE";

describe("deltaE", () => {
  it("computes CIE76 as Euclidean Lab distance", () => {
    expect(deltaE("cie76", { l: 50, a: 2, b: 3 }, { l: 52, a: 4, b: 4 })).toBeCloseTo(3, 6);
  });

  it("computes CIEDE2000 reference pair", () => {
    const value = deltaE(
      "ciede2000",
      { l: 50, a: 2.6772, b: -79.7751 },
      { l: 50, a: 0, b: -82.7485 },
    );
    expect(value).toBeCloseTo(2.0425, 3);
  });

  it("returns zero for identical colors across formulas", () => {
    const lab = { l: 62, a: -8, b: 30 };
    expect(deltaE("cie76", lab, lab)).toBeCloseTo(0, 6);
    expect(deltaE("cie94", lab, lab)).toBeCloseTo(0, 6);
    expect(deltaE("ciede2000", lab, lab)).toBeCloseTo(0, 6);
    expect(deltaE("cmc", lab, lab)).toBeCloseTo(0, 6);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- src/color/deltaE.test.ts`

Expected: fails because `src/color/deltaE.ts` does not exist.

- [ ] **Step 3: Implement Lab display conversion**

Create `src/color/lab.ts` with `labToXyz`, `xyzToLab`, `labToSrgb`, and `labToCssRgb`. Use D50 white for Lab conversion and clip sRGB only for display.

- [ ] **Step 4: Implement Delta E formulas**

Create `src/color/deltaE.ts` exporting:

```ts
import type { DeltaEFormula, LabColor } from "../types";

export function deltaE(formula: DeltaEFormula, sample: LabColor, standard: LabColor): number {
  if (formula === "cie76") return cie76(sample, standard);
  if (formula === "cie94") return cie94(sample, standard);
  if (formula === "ciede2000") return ciede2000(sample, standard);
  return cmc(sample, standard, 2, 1);
}
```

Implement helpers inside the same file: `cie76`, `cie94`, `ciede2000`, `cmc`, `degrees`, `radians`, and `chromaticity`.

- [ ] **Step 5: Verify math**

Run: `npm test -- src/color/deltaE.test.ts`

Expected: all tests pass.

---

## Task 3: Implement CxF Parsing With Spectral Fallback

**Files:**
- Create: `src/cxf/parseCxf.ts`
- Create: `src/cxf/parseCxf.test.ts`
- Create: `src/color/spectral.ts`
- Create: `src/test/fixtures/direct-lab.cxf`
- Create: `src/test/fixtures/spectral.cxf`
- Create: `src/test/fixtures/empty.cxf`

- [ ] **Step 1: Add CxF fixtures**

Create `src/test/fixtures/direct-lab.cxf` with two objects containing explicit Lab values. Create `src/test/fixtures/spectral.cxf` with one object containing reflectance values from 400 to 700 nm at 10 nm intervals. Create `src/test/fixtures/empty.cxf` with no usable color values.

- [ ] **Step 2: Write parser tests**

Create `src/cxf/parseCxf.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import directLab from "../test/fixtures/direct-lab.cxf?raw";
import spectral from "../test/fixtures/spectral.cxf?raw";
import empty from "../test/fixtures/empty.cxf?raw";
import { parseCxf } from "./parseCxf";

describe("parseCxf", () => {
  it("extracts explicit Lab colors", () => {
    const result = parseCxf(directLab);
    expect(result.errors).toEqual([]);
    expect(result.colors).toHaveLength(2);
    expect(result.colors[0]).toMatchObject({
      name: "Warm Gray",
      source: "lab",
      lab: { l: 62.3, a: 1.2, b: 5.6 },
    });
  });

  it("falls back to spectral conversion", () => {
    const result = parseCxf(spectral);
    expect(result.errors).toEqual([]);
    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].source).toBe("spectral");
    expect(result.colors[0].lab.l).toBeGreaterThan(0);
    expect(result.colors[0].lab.l).toBeLessThanOrEqual(100);
  });

  it("reports files with no usable colors", () => {
    const result = parseCxf(empty);
    expect(result.colors).toHaveLength(0);
    expect(result.errors[0]).toContain("No usable colors");
  });
});
```

- [ ] **Step 3: Run the failing parser tests**

Run: `npm test -- src/cxf/parseCxf.test.ts`

Expected: fails because parser and spectral modules do not exist.

- [ ] **Step 4: Implement spectral fallback**

Create `src/color/spectral.ts` with a compact D50/2 degree spectral integration table covering 400-700 nm at 10 nm intervals, interpolation for nearby uploaded values, and `spectralReflectanceToLab(samples)` returning `LabColor | null`.

- [ ] **Step 5: Implement CxF XML parsing**

Create `src/cxf/parseCxf.ts`:

```ts
import type { ImportResult, ResolvedColor } from "../types";
import { labToCssRgb } from "../color/lab";
import { spectralReflectanceToLab } from "../color/spectral";

export function parseCxf(xmlText: string): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return { colors: [], unresolved: [], errors: ["Invalid XML: the CxF file could not be parsed."] };
  }

  const objects = Array.from(doc.querySelectorAll("Object, Sample, Color, ColorSpecification"));
  const colors: ResolvedColor[] = [];
  const unresolved = [];

  for (const [index, object] of objects.entries()) {
    const name = readName(object) ?? `Color ${index + 1}`;
    const lab = readLab(object) ?? readSpectralLab(object);
    if (!lab) {
      unresolved.push({ name, reason: "No usable Lab or spectral reflectance data found." });
      continue;
    }
    colors.push({
      id: `${index}-${name}`,
      name,
      lab,
      displayRgb: labToCssRgb(lab),
      source: readLab(object) ? "lab" : "spectral",
    });
  }

  const errors = colors.length === 0 ? ["No usable colors were found in this CxF file."] : [];
  return { colors, unresolved, errors };
}
```

Add local helpers `readName`, `readLab`, `readSpectralLab`, `textNumber`, and `findNumberByNames`. Support common tag names such as `L`, `L*`, `CIEL`, `A`, `a*`, `CIEA`, `B`, `b*`, `CIEB`, and spectral wavelength/value pairs.

- [ ] **Step 6: Verify parsing**

Run: `npm test -- src/cxf/parseCxf.test.ts`

Expected: all parser tests pass.

---

## Task 4: Implement Tolerance Surface Sampling

**Files:**
- Create: `src/tolerance/surface.ts`
- Create: `src/tolerance/surface.test.ts`

- [ ] **Step 1: Write tolerance tests**

Create `src/tolerance/surface.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildToleranceSurface } from "./surface";

describe("buildToleranceSurface", () => {
  it("builds a CIE76 sphere with radius equal to tolerance", () => {
    const surface = buildToleranceSurface({ center: { l: 50, a: 0, b: 0 }, formula: "cie76", tolerance: 2 });
    expect(surface.vertices.length).toBeGreaterThan(100);
    const first = surface.vertices[0];
    const distance = Math.hypot(first.l - 50, first.a, first.b);
    expect(distance).toBeCloseTo(2, 3);
  });

  it("builds a finite CIEDE2000 sampled surface", () => {
    const surface = buildToleranceSurface({ center: { l: 50, a: 20, b: 30 }, formula: "ciede2000", tolerance: 2 });
    expect(surface.vertices.length).toBeGreaterThan(100);
    expect(surface.indices.length).toBeGreaterThan(100);
    expect(surface.vertices.every((vertex) => Number.isFinite(vertex.l + vertex.a + vertex.b))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing tolerance tests**

Run: `npm test -- src/tolerance/surface.test.ts`

Expected: fails because `surface.ts` does not exist.

- [ ] **Step 3: Implement surface generation**

Create `src/tolerance/surface.ts` exporting `buildToleranceSurface({ center, formula, tolerance, rings = 18, segments = 36 })`. For `cie76`, place vertices exactly at `center + direction * tolerance`. For other formulas, binary-search along each spherical direction until `deltaE(formula, candidate, center)` is close to tolerance.

- [ ] **Step 4: Verify tolerance sampling**

Run: `npm test -- src/tolerance/surface.test.ts`

Expected: all tolerance tests pass.

---

## Task 5: Build The React UI And Three.js Scene

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/ControlsPanel.tsx`
- Create: `src/components/ColorList.tsx`
- Create: `src/components/LabScene.tsx`

- [ ] **Step 1: Create controls and list components**

Create `ControlsPanel.tsx` with file upload, formula selector, tolerance input defaulting to `2`, selected color details, and import summary. Create `ColorList.tsx` with a search input and selectable resolved color rows.

- [ ] **Step 2: Create the Three.js scene component**

Create `LabScene.tsx` with:

- Perspective camera and orbit controls.
- Axis lines for `L*`, `a*`, and `b*`.
- Point sprites or small spheres for resolved colors.
- Raycasting selection on point click.
- Highlight ring or larger emissive marker for the selected color.
- Translucent tolerance mesh built from `buildToleranceSurface`.

- [ ] **Step 3: Wire top-level state**

Modify `App.tsx` to hold:

```ts
const [importResult, setImportResult] = useState<ImportResult>({ colors: [], unresolved: [], errors: [] });
const [selectedId, setSelectedId] = useState<string | null>(null);
const [formula, setFormula] = useState<DeltaEFormula>("ciede2000");
const [tolerance, setTolerance] = useState(2);
```

Add file upload handling with `File.text()` and `parseCxf(text)`. Select the first resolved color after a successful import.

- [ ] **Step 4: Refine responsive styling**

Update `styles.css` so the app has a stable full-height scene, compact controls, scrollable color list, clear selected states, and no text overlap at mobile width.

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: build succeeds with no TypeScript errors.

---

## Task 6: Verify End-To-End In The Browser

**Files:**
- No new source files unless browser verification reveals defects.

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: all module tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Vite production build completes successfully.

- [ ] **Step 3: Start the local dev server**

Run: `npm run dev -- --port 5173`

Expected: local URL is available at `http://127.0.0.1:5173/`.

- [ ] **Step 4: Open the app in the browser**

Use the in-app browser to open `http://127.0.0.1:5173/`. Confirm the 3D canvas is visible and nonblank at desktop and mobile widths.

- [ ] **Step 5: Exercise the workflow**

Upload `src/test/fixtures/direct-lab.cxf`, select a listed color, change the Delta E formula, change tolerance from `2` to `4`, and confirm the selected point and tolerance mesh update.

- [ ] **Step 6: Fix any verification issues**

If text overlaps, the canvas is blank, picking fails, or tolerance mesh does not update, make the smallest source change that addresses the observed issue, then repeat Steps 1-5.

---

## Self-Review

- Spec coverage: The plan covers browser-only operation, CxF upload, direct Lab parsing, spectral fallback, 3D Lab plotting, color selection, Delta E formula selection, default tolerance `2`, CIE76 sphere behavior, sampled non-Euclidean surfaces, import summaries, and browser verification.
- Placeholder scan: No `TBD` or open-ended implementation placeholders remain. Broad UI and Three.js steps are intentional component tasks, with concrete expected behaviors listed.
- Type consistency: Shared names are `LabColor`, `ResolvedColor`, `ImportResult`, `DeltaEFormula`, `parseCxf`, `deltaE`, and `buildToleranceSurface`, and they are used consistently across tasks.
