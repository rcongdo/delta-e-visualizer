import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedColor } from "../types";
import { getGamutClient, type GamutClient } from "./gamutClient";
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

type Loaded = { client: GamutClient; profileId: number; info: ProfileInfo; shell: GamutShell };

/** `colors` must be referentially stable between renders (it comes from state); a new array re-runs the round trip. */
export function useGamutProfile(colors: ResolvedColor[]): GamutProfileState {
  const loadSequenceRef = useRef(0);
  const loadedRef = useRef<Loaded | null>(null);
  const [selection, setSelection] = useState<GamutSelection>({ kind: "none" });
  const [pendingSelection, setPendingSelection] = useState<GamutSelection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roundTripError, setRoundTripError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reproductions, setReproductions] = useState<Map<string, Reproduction> | null>(null);

  // Best effort: a failed release only means the worker keeps an unused engine.
  const releaseProfile = useCallback((profile: { client: GamutClient; profileId: number }) => {
    profile.client.release(profile.profileId).catch(() => {});
  }, []);

  const load = useCallback(
    (next: GamutSelection, readBytes: () => Promise<ArrayBuffer>) => {
      const sequence = loadSequenceRef.current + 1;
      loadSequenceRef.current = sequence;
      setPendingSelection(next);
      setLoadError(null);

      const client = getGamutClient();
      readBytes()
        .then((bytes) => client.loadProfile(bytes))
        .then((result) => {
          const profile: Loaded = { client, ...result };
          if (sequence !== loadSequenceRef.current) {
            releaseProfile(profile);
            return;
          }
          const previous = loadedRef.current;
          loadedRef.current = profile;
          setSelection(next);
          setLoaded(profile);
          setPendingSelection(null);
          if (previous) {
            releaseProfile(previous);
          }
        })
        .catch((reason: unknown) => {
          if (sequence !== loadSequenceRef.current) {
            return;
          }
          setLoadError(errorMessage(reason));
          setPendingSelection(null);
        });
    },
    [releaseProfile],
  );

  const selectPreset = useCallback(
    (presetId: string | null) => {
      const preset = presetId ? findPreset(presetId) : null;
      if (!preset) {
        loadSequenceRef.current += 1;
        setSelection({ kind: "none" });
        setPendingSelection(null);
        setLoadError(null);
        setLoaded(null);
        if (loadedRef.current) {
          releaseProfile(loadedRef.current);
          loadedRef.current = null;
        }
        return;
      }

      load({ kind: "preset", presetId: preset.id }, async () => {
        const response = await fetch(presetUrl(preset)).catch((reason: unknown) => {
          throw new Error(`Could not download ${preset.label}: ${errorMessage(reason)}`);
        });
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
    setRoundTripError(null);
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

    loaded.client
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
          setRoundTripError(errorMessage(reason));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [colors, loaded]);

  return {
    selection,
    pendingSelection,
    error: loadError ?? roundTripError,
    info: loaded?.info ?? null,
    shell: loaded?.shell ?? null,
    reproductions,
    selectPreset,
    uploadProfile,
  };
}
