import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { instantiate } from "lcms-wasm";

export const lcmsReady = instantiate();

export function readPresetBytes(file: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`../../public/profiles/${file}`, import.meta.url))));
}
