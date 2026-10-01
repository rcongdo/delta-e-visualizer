import type { LabColor } from "../types";

export type GamutStatus = "in" | "within" | "out";

export type ProfileInfo = {
  name: string;
  colorSpace: string;
  channelNames: string[];
};

/** Triangle mesh in Lab: positions are L, a, b triplets. */
export type GamutShell = {
  positions: Float32Array;
  indices: Uint32Array;
};

export type Reproduction = {
  reproducedLab: LabColor;
  /** Device values in display units: 0–100 for ink channels, 0–255 for RGB/Gray. */
  deviceValues: number[];
};

export type GamutResult = Reproduction & {
  achievableDeltaE: number;
  status: GamutStatus;
};

export type WorkerCommand =
  | { type: "load"; bytes: ArrayBuffer }
  | { type: "roundTrip"; profileId: number; labs: Float32Array }
  | { type: "release"; profileId: number };

export type WorkerRequest = WorkerCommand & { id: number };

export type WorkerResponse =
  | { id: number; type: "loaded"; profileId: number; info: ProfileInfo; shell: GamutShell }
  | { id: number; type: "roundTripped"; reproducedLabs: Float32Array; deviceValues: Float32Array }
  | { id: number; type: "released" }
  | { id: number; type: "error"; message: string };
