# Lab Color Space Visualizer Design

## Goal

Create a browser-only web app for visualizing color standards from CxF files in 3D CIELAB space. Users can upload a `.cxf` file, see resolved colors plotted in Lab coordinates, select a color, and visualize a Delta E tolerance volume around it.

## Scope

The first version runs entirely in the browser. It does not upload files to a server, persist standards between sessions, require accounts, or store user data beyond transient page state.

## User Workflow

1. The user opens the app and sees the 3D Lab visualization workspace.
2. The user uploads a `.cxf` XML file.
3. The app parses color definitions and resolves each usable color to Lab.
4. The app plots resolved colors as points in 3D Lab space.
5. The user selects a color from the 3D plot or color list.
6. The selected point is highlighted and its metadata appears in the details panel.
7. The user chooses a Delta E formula and tolerance value, defaulting to `2`.
8. The app renders the tolerance region around the selected color.

## CxF Import

The importer parses CxF XML in the browser.

Resolution order:

1. Use explicit CIELAB values when present.
2. If Lab values are missing, attempt spectral reflectance conversion using a built-in D50 illuminant and 2 degree observer path.
3. If neither route succeeds, list the color as unresolved in the import summary.

The importer should tolerate common naming and nesting differences across CxF variants, but the first version does not promise exhaustive support for every vendor-specific structure.

## Color Science

Supported Delta E formulas for the first version:

- CIE76
- CIE94
- CIEDE2000
- CMC l:c

The default tolerance is `2`.

For spectral fallback, the first version uses built-in color matching and illuminant data. If the source contains enough wavelength/value pairs, the app integrates reflectance to XYZ, normalizes against the illuminant white, and converts XYZ to Lab.

## 3D Visualization

The app uses Three.js.

Coordinate mapping:

- `L*`: vertical axis
- `a*`: horizontal axis
- `b*`: depth axis

Imported standards render as colorized points using an approximate Lab-to-sRGB conversion for display. Colors outside the sRGB gamut are clipped for point display only; their Lab coordinates remain unchanged.

Selection behavior:

- Selecting a list item or point highlights that point.
- The camera target moves toward the selected point.
- Details display name, Lab values, source path when known, and whether Lab came from direct values or spectral fallback.

## Delta E Tolerance Visualization

For CIE76, the tolerance region renders as a sphere centered on the selected Lab point.

For CIE94, CIEDE2000, and CMC l:c, the app samples directions around the selected Lab point, solves for the distance where the selected formula equals the tolerance, and renders a translucent mesh. These volumes are expected to appear ellipsoid-like but may be asymmetric depending on the formula and location in Lab space.

The tolerance mesh updates when the user changes formula, tolerance, or selected color.

## Interface

The first screen is the working tool, not a marketing page. It contains:

- File upload for `.cxf`
- 3D Lab scene with axes and orbit controls
- Color list with search/filter
- Selected color details
- Delta E formula selector
- Tolerance numeric input
- Import summary for resolved and unresolved colors

The layout should be dense, calm, and operational: a tool for inspecting color standards rather than a decorative landing page.

## Error Handling

The app should surface:

- Invalid XML
- CxF files with no usable colors
- Colors skipped because Lab or spectral data could not be resolved
- Spectral rows with unsupported or incomplete wavelength data

Errors should be visible in the import summary without blocking successfully resolved colors.

## Testing And Verification

Validation should include:

- Direct Lab CxF fixture parsing
- Spectral fallback fixture parsing
- Invalid or empty CxF handling
- Delta E sanity checks for each formula
- Browser verification that the Three.js canvas is nonblank
- Browser verification that upload, selection, formula choice, and tolerance changes update the scene

## Non-Goals For First Version

- Server-side persistence
- User accounts
- Saving uploaded CxF files
- Full vendor-specific CxF compatibility
- Custom illuminant/observer controls
- Exporting plots or reports
