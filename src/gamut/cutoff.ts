/**
 * Achievable ΔE00 at or below this value counts as "in gamut" (green).
 *
 * Measured 2026-10-01 with LittleCMS 2.16 (lcms-wasm 1.0.5): CMYK grids
 * (levels 0/10/25/40/55/70/85/100, TAC ≤ 240%, 3,155 patches) were converted
 * to Lab through each preset's A2B and round-tripped with absolute colorimetric
 * intent. Printable patches still return with error, mostly in K-bearing
 * shadows where B2A black generation differs from A2B (CRPC3 0/100/0/100
 * returns as 51/74/50/80, ΔE00 3.7). Share of patches ≤ 1.0: CRPC1 81%,
 * CRPC2 89%, CRPC3 81%, CRPC4 96%, CRPC5 97%, CRPC6 96%, CRPC7 98%.
 * A p99 rule (≈ 2.1) would exceed the default tolerance of 2 and hide amber,
 * so 1.0 was chosen: printable-but-imperfect colors show as amber.
 */
export const IN_GAMUT_CUTOFF = 1;
