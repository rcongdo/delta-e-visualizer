import { describe, expect, it } from "vitest";
import directLabCxf from "../test/fixtures/direct-lab.cxf?raw";
import emptyCxf from "../test/fixtures/empty.cxf?raw";
import spectralCxf from "../test/fixtures/spectral.cxf?raw";
import { parseCxf } from "./parseCxf";

const spectralValueArray =
  "8 8 8 8 8 9 10 12 16 24 36 48 58 62 64 61 54 44 34 25 18 14 12 10 9 8 8 8 8 8 8";

describe("parseCxf", () => {
  it("extracts explicit Lab colors before using fallbacks", () => {
    const result = parseCxf(directLabCxf);

    expect(result.errors).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.colors).toHaveLength(2);
    expect(result.colors[0]).toMatchObject({
      id: "warm-gray",
      name: "Warm Gray",
      lab: { l: 62.3, a: 1.2, b: 5.6 },
      source: "lab",
    });
    expect(result.colors[0].displayRgb).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(result.colors[1]).toMatchObject({
      id: "cool-blue",
      name: "Cool Blue",
      lab: { l: 48.1, a: -8.4, b: -24.2 },
      source: "lab",
    });
  });

  it("falls back to spectral reflectance when Lab is absent", () => {
    const result = parseCxf(spectralCxf);

    expect(result.errors).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].name).toBe("Spectral Green");
    expect(result.colors[0].source).toBe("spectral");
    expect(result.colors[0].lab.l).toBeGreaterThanOrEqual(0);
    expect(result.colors[0].lab.l).toBeLessThanOrEqual(100);
    expect(Number.isFinite(result.colors[0].lab.a)).toBe(true);
    expect(Number.isFinite(result.colors[0].lab.b)).toBe(true);
    expect(result.colors[0].displayRgb).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it("rejects sparse spectral reflectance instead of plotting misleading Lab", () => {
    const result = parseCxf(`
      <CxF>
        <Object ID="sparse" Name="Sparse Spectral">
          <ReflectanceSpectrum>
            <Sample wavelength="500" value="0.5" />
            <Sample wavelength="510" value="0.55" />
          </ReflectanceSpectrum>
        </Object>
      </CxF>
    `);

    expect(result.colors).toEqual([]);
    expect(result.unresolved).toEqual([
      {
        name: "Sparse Spectral",
        path: "Object[sparse]",
        reason: "No usable Lab or spectral data found",
      },
    ]);
    expect(result.errors).toContain("No usable colors found");
  });

  it("rejects endpoint-only spectra even though interpolation could fill the grid", () => {
    const result = parseCxf(`
      <CxF>
        <Object ID="endpoints" Name="Endpoint Spectral">
          <ReflectanceSpectrum>
            <Sample wavelength="400" value="0.1" />
            <Sample wavelength="700" value="0.7" />
          </ReflectanceSpectrum>
        </Object>
      </CxF>
    `);

    expect(result.colors).toEqual([]);
    expect(result.unresolved[0]).toMatchObject({
      name: "Endpoint Spectral",
      path: "Object[endpoints]",
      reason: "No usable Lab or spectral data found",
    });
    expect(result.errors).toContain("No usable colors found");
  });

  it("reports objects without usable color data and an empty import error", () => {
    const result = parseCxf(emptyCxf);

    expect(result.colors).toEqual([]);
    expect(result.unresolved).toEqual([
      {
        name: "No Color Data",
        path: "Object[no-color]",
        reason: "No usable Lab or spectral data found",
      },
    ]);
    expect(result.errors).toContain("No usable colors found");
  });

  it("normalizes percent reflectance values before spectral conversion", () => {
    const result = parseCxf(`
      <CxF>
        <Object ID="percent" Name="Percent Spectral">
          <ReflectanceSpectrum>
            <Sample wavelength="400" value="8" />
            <Sample wavelength="410" value="8" />
            <Sample wavelength="420" value="8" />
            <Sample wavelength="430" value="8" />
            <Sample wavelength="440" value="8" />
            <Sample wavelength="450" value="9" />
            <Sample wavelength="460" value="10" />
            <Sample wavelength="470" value="12" />
            <Sample wavelength="480" value="16" />
            <Sample wavelength="490" value="24" />
            <Sample wavelength="500" value="36" />
            <Sample wavelength="510" value="48" />
            <Sample wavelength="520" value="58" />
            <Sample wavelength="530" value="62" />
            <Sample wavelength="540" value="64" />
            <Sample wavelength="550" value="61" />
            <Sample wavelength="560" value="54" />
            <Sample wavelength="570" value="44" />
            <Sample wavelength="580" value="34" />
            <Sample wavelength="590" value="25" />
            <Sample wavelength="600" value="18" />
            <Sample wavelength="610" value="14" />
            <Sample wavelength="620" value="12" />
            <Sample wavelength="630" value="10" />
            <Sample wavelength="640" value="9" />
            <Sample wavelength="650" value="8" />
            <Sample wavelength="660" value="8" />
            <Sample wavelength="670" value="8" />
            <Sample wavelength="680" value="8" />
            <Sample wavelength="690" value="8" />
            <Sample wavelength="700" value="8" />
          </ReflectanceSpectrum>
        </Object>
      </CxF>
    `);

    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].source).toBe("spectral");
    expect(result.colors[0].lab.l).toBeGreaterThan(0);
    expect(result.colors[0].lab.l).toBeLessThan(95);
  });

  it("parses array-based spectral values from start wavelength and interval metadata", () => {
    const result = parseCxf(`
      <CxF>
        <Object ID="array" Name="Array Spectral">
          <ReflectanceSpectrum StartWL="400" Increment="10">${spectralValueArray}</ReflectanceSpectrum>
        </Object>
      </CxF>
    `);

    expect(result.errors).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].name).toBe("Array Spectral");
    expect(result.colors[0].source).toBe("spectral");
    expect(result.colors[0].lab.l).toBeGreaterThan(0);
    expect(result.colors[0].lab.l).toBeLessThan(95);
  });

  it("interpolates 5 nm spectral samples onto the internal 10 nm grid", () => {
    const result = parseCxf(`
      <CxF>
        <Object ID="five-nm" Name="Five Nanometer Spectral">
          <ReflectanceSpectrum>
            ${Array.from({ length: 61 }, (_, index) => {
              const wavelength = 400 + index * 5;
              const value = wavelength >= 500 && wavelength <= 560 ? 0.55 : 0.12;
              return `<Sample wavelength="${wavelength}" value="${value}" />`;
            }).join("")}
          </ReflectanceSpectrum>
        </Object>
      </CxF>
    `);

    expect(result.errors).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].source).toBe("spectral");
    expect(result.colors[0].lab.l).toBeGreaterThan(0);
    expect(result.colors[0].lab.l).toBeLessThan(100);
  });

  it("parses namespaced CxF elements by local name", () => {
    const result = parseCxf(`
      <cxf:CxF xmlns:cxf="urn:example:cxf">
        <cxf:ObjectCollection>
          <cxf:Object cxf:ID="namespaced">
            <cxf:Name>Namespaced Lab</cxf:Name>
            <cxf:ColorSpecification>
              <cxf:CIELab>
                <cxf:CIEL>55</cxf:CIEL>
                <cxf:CIEA>3</cxf:CIEA>
                <cxf:CIEB>-4</cxf:CIEB>
              </cxf:CIELab>
            </cxf:ColorSpecification>
          </cxf:Object>
        </cxf:ObjectCollection>
      </cxf:CxF>
    `);

    expect(result.errors).toEqual([]);
    expect(result.colors).toHaveLength(1);
    expect(result.colors[0]).toMatchObject({
      id: "namespaced",
      name: "Namespaced Lab",
      lab: { l: 55, a: 3, b: -4 },
      source: "lab",
    });
  });

  it("keeps nested multiple color specifications as separate colors", () => {
    const result = parseCxf(`
      <CxF>
        <Object ID="book" Name="Book">
          <ColorSpecification ID="first" Name="First Patch">
            <CIELab><L>40</L><A>1</A><B>2</B></CIELab>
          </ColorSpecification>
          <ColorSpecification ID="second" Name="Second Patch">
            <CIELab><L>70</L><A>3</A><B>4</B></CIELab>
          </ColorSpecification>
        </Object>
      </CxF>
    `);

    expect(result.errors).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.colors).toHaveLength(2);
    expect(result.colors.map((color) => color.name)).toEqual(["First Patch", "Second Patch"]);
    expect(result.colors.map((color) => color.lab.l)).toEqual([40, 70]);
  });
});
