import { instantiate } from "lcms-wasm";
import wasmUrl from "lcms-wasm/dist/lcms.wasm?url";
import { IN_GAMUT_CUTOFF } from "./cutoff";
import { createProfileEngine, type ProfileEngine } from "./engine";
import { buildGamutShell } from "./shell";
import type { GamutShell, WorkerRequest, WorkerResponse } from "./types";

const lcmsReady = instantiate({ locateFile: () => wasmUrl }).catch((error: unknown) => {
  throw new Error(`Could not start the color engine: ${error instanceof Error ? error.message : String(error)}`);
});

let engine: ProfileEngine | null = null;

const post = (response: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(response, { transfer });

// Messages are handled in arrival order: the only await is on lcmsReady, which
// resolves once, so a round trip sent after a load always sees that load's engine.
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    const lcms = await lcmsReady;

    if (request.type === "load") {
      const next = createProfileEngine(lcms, new Uint8Array(request.bytes));
      let shell: GamutShell;
      try {
        shell = buildGamutShell(next.roundTrip, IN_GAMUT_CUTOFF);
      } catch (error) {
        next.dispose();
        throw error;
      }
      engine?.dispose();
      engine = next;
      post({ id: request.id, type: "loaded", info: next.info, shell }, [shell.positions.buffer, shell.indices.buffer]);
      return;
    }

    if (!engine) {
      throw new Error("No profile is loaded.");
    }
    const { reproducedLabs, deviceValues } = engine.roundTrip(request.labs);
    post({ id: request.id, type: "roundTripped", reproducedLabs, deviceValues }, [
      reproducedLabs.buffer,
      deviceValues.buffer,
    ]);
  } catch (error) {
    post({ id: request.id, type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
