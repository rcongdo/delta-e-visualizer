import type { GamutShell, ProfileInfo, WorkerCommand, WorkerResponse } from "./types";

export type GamutClient = {
  /** Transfers `bytes` to the worker; the caller's buffer is detached afterwards. */
  loadProfile: (bytes: ArrayBuffer) => Promise<{ profileId: number; info: ProfileInfo; shell: GamutShell }>;
  roundTrip: (profileId: number, labs: Float32Array) => Promise<{ reproducedLabs: Float32Array; deviceValues: Float32Array }>;
  /** Frees a loaded profile in the worker. Resolves once released. */
  release: (profileId: number) => Promise<void>;
  /** True once the worker has died; such a client only returns errors. */
  readonly failed: boolean;
  dispose: () => void;
};

// Request ids double as profile ids. The counter is module-level so ids keep
// increasing across replacement workers and never name an engine in another worker.
let nextId = 1;

export function createGamutClient(): GamutClient {
  const worker = new Worker(new URL("./gamut.worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, (response: WorkerResponse) => void>();
  let failure: string | null = null;

  const fail = (message: string) => {
    if (failure !== null) {
      return;
    }
    failure = message;
    worker.terminate();
    pending.forEach((settle, id) => settle({ id, type: "error", message }));
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const settle = pending.get(event.data.id);
    pending.delete(event.data.id);
    settle?.(event.data);
  };

  worker.onerror = (event) => fail(event.message || "The color engine stopped unexpectedly.");
  worker.onmessageerror = () => fail("The color engine stopped unexpectedly.");

  const send = (command: WorkerCommand, transfer: Transferable[]) =>
    new Promise<WorkerResponse>((resolve) => {
      const id = nextId;
      nextId += 1;
      if (failure !== null) {
        resolve({ id, type: "error", message: failure });
        return;
      }
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
      return { profileId: response.profileId, info: response.info, shell: response.shell };
    },
    async roundTrip(profileId, labs) {
      const response = await send({ type: "roundTrip", profileId, labs }, [labs.buffer]);
      if (response.type === "error") {
        throw new Error(response.message);
      }
      if (response.type !== "roundTripped") {
        throw new Error("Unexpected response from the color engine.");
      }
      return { reproducedLabs: response.reproducedLabs, deviceValues: response.deviceValues };
    },
    async release(profileId) {
      const response = await send({ type: "release", profileId }, []);
      if (response.type === "error") {
        throw new Error(response.message);
      }
      if (response.type !== "released") {
        throw new Error("Unexpected response from the color engine.");
      }
    },
    get failed() {
      return failure !== null;
    },
    dispose() {
      fail("The color engine was shut down.");
    },
  };
}

let sharedClient: GamutClient | null = null;

/** One client for the life of the page; replaced only after its worker has died. */
export function getGamutClient(): GamutClient {
  if (!sharedClient || sharedClient.failed) {
    sharedClient = createGamutClient();
  }
  return sharedClient;
}
