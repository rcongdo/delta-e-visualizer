declare module "lcms-wasm" {
  export type LcmsModule = {
    cmsOpenProfileFromMem(data: Uint8Array, size: number): number;
    _malloc(size: number): number;
    _free(pointer: number): void;
    _cmsOpenProfileFromMem(pointer: number, size: number): number;
    HEAPU8: Uint8Array;
    cmsCloseProfile(profile: number): void;
    cmsCreateLab4Profile(whitePoint: number[] | null): number;
    cmsFormatterForColorspaceOfProfile(profile: number, bytesPerChannel: number, isFloat: boolean): number;
    cmsCreateTransform(
      input: number,
      inputFormat: number,
      output: number,
      outputFormat: number,
      intent: number,
      flags: number,
    ): number;
    cmsDeleteTransform(transform: number): void;
    cmsDoTransform(transform: number, input: Float32Array, pixelCount: number): Float32Array;
    cmsGetProfileInfoASCII(profile: number, info: number, languageCode: string, countryCode: string): string;
  };

  export function instantiate(options?: { locateFile?: (name: string) => string }): Promise<LcmsModule>;
  export const INTENT_ABSOLUTE_COLORIMETRIC: number;
  export const cmsInfoDescription: number;
  export function T_CHANNELS(format: number): number;
  export function T_COLORSPACE(format: number): number;
}
