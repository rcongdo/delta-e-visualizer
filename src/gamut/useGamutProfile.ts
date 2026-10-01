import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedColor } from "../types";
import { createGamutClient, type GamutClient } from "./gamutClient";
import { findPreset, presetUrl } from "./presets";
import type { GamutShell, ProfileInfo, Reproduction } from "./types";

export type GamutSelection = { kind: "none" } | { kind: "preset"; presetId: string } | { kind: "upload"; fileName: string };

export type GamutProfileState = {
  /** The profile currently in use. */
  selection: GamutSelection;
  /** A profile that is loading and will replace `selection` if it succeeds. */
  pendingSelection: GamutSelection | null;
  error: string | null;
  info: ProfileInfo | null;
  shell: GamutShell | null;
  reproductions: Map<string, Reproduction> | null;
  selectPreset: (presetId: string | null) => void;
  uploadProfile: (file: File) => void;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useGamutProfile(colors: ResolvedColor[]): GamutProfileState {
  const clientRef = useRef<GamutClient | null>(null);
  const loadSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const loadedProfileIdRef = useRef<number | null>(null);
  const [selection, setSelection] = useState<GamutSelection>({ kind: "none" });
  const [pendingSelection, setPendingSelection] = useState<GamutSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ profileId: number; info: ProfileInfo; shell: GamutShell } | null>(null);
  const [reproductions, setReproductions] = useState<Map<string, Reproduction> | null>(null);

  const getClient = useCallback(() => {
    if (!mountedRef.current) {
      throw new Error("Gamut profile hook is unmounted.");
    }
    clientRef.current ??= createGamutClient();
    return clientRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clientRef.current?.dispose();
      clientRef.current = null;
      loadedProfileIdRef.current = null;
    };
  }, []);

  // Best effort: a failed release only means the worker keeps an unused engine.
  const releaseProfile = useCallback((profileId: number) => {
    clientRef.current?.release(profileId).catch(() => {});
  }, []);

  const load = useCallback(
    (next: GamutSelection, readBytes: () => Promise<ArrayBuffer>) => {
      const sequence = loadSequenceRef.current + 1;
      loadSequenceRef.current = sequence;
      setPendingSelection(next);
      setError(null);

      readBytes()
        .then((bytes) => getClient().loadProfile(bytes))
        .then((result) => {
          if (sequence !== loadSequenceRef.current) {
            releaseProfile(result.profileId);
            return;
          }
          const previousProfileId = loadedProfileIdRef.current;
          loadedProfileIdRef.current = result.profileId;
          setSelection(next);
          setLoaded(result);
          setPendingSelection(null);
          if (previousProfileId !== null) {
            releaseProfile(previousProfileId);
          }
        })
        .catch((reason: unknown) => {
          if (sequence !== loadSequenceRef.current) {
            return;
          }
          setError(errorMessage(reason));
          setPendingSelection(null);
        });
    },
    [getClient, releaseProfile],
  );

  const selectPreset = useCallback(
    (presetId: string | null) => {
      const preset = presetId ? findPreset(presetId) : null;
      if (!preset) {
        loadSequenceRef.current += 1;
        setSelection({ kind: "none" });
        setPendingSelection(null);
        setError(null);
        setLoaded(null);
        if (loadedProfileIdRef.current !== null) {
          releaseProfile(loadedProfileIdRef.current);
          loadedProfileIdRef.current = null;
        }
        return;
      }

      load({ kind: "preset", presetId: preset.id }, async () => {
        const response = await fetch(presetUrl(preset));
        if (!response.ok) {
          throw new Error(`Could not download ${preset.label} (HTTP ${response.status}).`);
        }
        return response.arrayBuffer();
      });
    },
    [load, releaseProfile],
  );

  const uploadProfile = useCallback(
    (file: File) => {
      load({ kind: "upload", fileName: file.name }, () => file.arrayBuffer());
    },
    [load],
  );

  useEffect(() => {
    setReproductions(null);
    if (!loaded || colors.length === 0) {
      return;
    }

    let cancelled = false;
    const labs = new Float32Array(colors.length * 3);
    colors.forEach((color, index) => {
      labs[index * 3] = color.lab.l;
      labs[index * 3 + 1] = color.lab.a;
      labs[index * 3 + 2] = color.lab.b;
    });

    getClient()
      .roundTrip(loaded.profileId, labs)
      .then(({ reproducedLabs, deviceValues }) => {
        if (cancelled) {
          return;
        }
        const channels = loaded.info.channelNames.length;
        setReproductions(
          new Map(
            colors.map((color, index) => [
              color.id,
              {
                reproducedLab: {
                  l: reproducedLabs[index * 3],
                  a: reproducedLabs[index * 3 + 1],
                  b: reproducedLabs[index * 3 + 2],
                },
                deviceValues: Array.from(deviceValues.subarray(index * channels, (index + 1) * channels)),
              },
            ]),
          ),
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(errorMessage(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [colors, getClient, loaded]);

  return {
    selection,
    pendingSelection,
    error,
    info: loaded?.info ?? null,
    shell: loaded?.shell ?? null,
    reproductions,
    selectPreset,
    uploadProfile,
  };
}
