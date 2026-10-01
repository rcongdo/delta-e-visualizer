import type { GamutShell, ProfileInfo, WorkerCommand, WorkerResponse } from "./types";

export type GamutClient = {
  /** Transfers `bytes` to the worker; the caller's buffer is detached afterwards. */
  loadProfile: (bytes: ArrayBuffer) => Promise<{ info: ProfileInfo; shell: GamutShell }>;
  roundTrip: (labs: Float32Array) => Promise<{ reproducedLabs: Float32Array; deviceValues: Float32Array }>;
  dispose: () => void;
};

export function createGamutClient(): GamutClient {
  const worker = new Worker(new URL("./gamut.worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, (response: WorkerResponse) => void>();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const settle = pending.get(event.data.id);
    pending.delete(event.data.id);
    settle?.(event.data);
  };

  worker.onerror = (event) => {
    const message = event.message || "The color engine stopped unexpectedly.";
    pending.forEach((settle, id) => settle({ id, type: "error", message }));
    pending.clear();
  };

  const send = (command: WorkerCommand, transfer: Transferable[]) =>
    new Promise<WorkerResponse>((resolve) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, resolve);
      worker.postMessage({ ...command, id }, transfer);
    });

  return {
    async loadProfile(bytes) {
      const response = await send({ type: "load", bytes }, [bytes]);
      if (response.type === "error") {
        throw new Error(response.message);
      }
      if (response.type !== "loaded") {
        throw new Error("Unexpected response from the color engine.");
      }
      return { info: response.info, shell: response.shell };
    },
    async roundTrip(labs) {
      const response = await send({ type: "roundTrip", labs }, [labs.buffer]);
      if (response.type === "error") {
        throw new Error(response.message);
      }
      if (response.type !== "roundTripped") {
        throw new Error("Unexpected response from the color engine.");
      }
      return { reproducedLabs: response.reproducedLabs, deviceValues: response.deviceValues };
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}
