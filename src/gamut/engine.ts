import { INTENT_ABSOLUTE_COLORIMETRIC, T_COLORSPACE, cmsInfoDescription } from "lcms-wasm";
import type { LcmsModule } from "lcms-wasm";
import { describeColorSpace } from "./colorSpace";
import { validateProfileHeader } from "./profileHeader";
import type { ProfileInfo } from "./types";

export type RoundTripOutput = {
  /** L, a, b triplets after Lab → device → Lab. */
  reproducedLabs: Float32Array;
  /** Device values in display units, channel-interleaved. */
  deviceValues: Float32Array;
};

export type ProfileEngine = {
  info: ProfileInfo;
  /** Absolute colorimetric Lab → device → Lab for L, a, b triplets. */
  roundTrip: (labs: Float32Array) => RoundTripOutput;
  /** Device → Lab, taking device values in the same display units that roundTrip returns. Used for calibration and tests. */
  deviceToLab: (device: Float32Array) => Float32Array;
  dispose: () => void;
};

export function createProfileEngine(lcms: LcmsModule, bytes: Uint8Array): ProfileEngine {
  const headerError = validateProfileHeader(bytes);
  if (headerError) {
    throw new Error(headerError);
  }

  // The cmsOpenProfileFromMem wrapper copies bytes onto the small WASM stack, which crashes on large
  // profiles. Copy onto the heap instead; LittleCMS copies the data, so freeing straight away is safe.
  const pointer = lcms._malloc(bytes.byteLength);
  if (!pointer) {
    throw new Error("Profile is too large to load.");
  }
  let profile: number;
  try {
    lcms.HEAPU8.set(bytes, pointer);
    profile = lcms._cmsOpenProfileFromMem(pointer, bytes.byteLength);
  } finally {
    lcms._free(pointer);
  }
  if (!profile) {
    throw new Error("LittleCMS could not read this profile.");
  }

  let labProfile = 0;
  const transforms: number[] = [];
  let disposed = false;
  const release = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    transforms.forEach((transform) => lcms.cmsDeleteTransform(transform));
    lcms.cmsCloseProfile(profile);
    if (labProfile) {
      lcms.cmsCloseProfile(labProfile);
    }
  };
  const assertLive = () => {
    if (disposed) {
      throw new Error("Profile engine has been disposed.");
    }
  };

  try {
    labProfile = lcms.cmsCreateLab4Profile(null);
    if (!labProfile) {
      throw new Error("LittleCMS could not create a Lab profile.");
    }

    const labFormat = lcms.cmsFormatterForColorspaceOfProfile(labProfile, 4, true);
    const deviceFormat = lcms.cmsFormatterForColorspaceOfProfile(profile, 4, true);
    const space = describeColorSpace(T_COLORSPACE(deviceFormat));
    if (!space) {
      throw new Error("This profile's device color space is not supported.");
    }

    const toDevice = lcms.cmsCreateTransform(
      labProfile,
      labFormat,
      profile,
      deviceFormat,
      INTENT_ABSOLUTE_COLORIMETRIC,
      0,
    );
    if (toDevice) {
      transforms.push(toDevice);
    }
    const toLab = lcms.cmsCreateTransform(
      profile,
      deviceFormat,
      labProfile,
      labFormat,
      INTENT_ABSOLUTE_COLORIMETRIC,
      0,
    );
    if (toLab) {
      transforms.push(toLab);
    }
    if (!toDevice || !toLab) {
      throw new Error("This profile can't convert Lab → device → Lab (missing A2B or B2A table).");
    }

    const name =
      lcms.cmsGetProfileInfoASCII(profile, cmsInfoDescription, "en", "US").replace(/\0/g, "").trim() ||
      "Untitled profile";
    const channelCount = space.channelNames.length;

    return {
      info: { name, colorSpace: space.colorSpace, channelNames: space.channelNames },
      roundTrip(labs) {
        assertLive();
        if (labs.length % 3 !== 0) {
          throw new Error("Lab input length must be a multiple of 3.");
        }
        const count = labs.length / 3;
        if (count === 0) {
          return { reproducedLabs: new Float32Array(0), deviceValues: new Float32Array(0) };
        }

        const device = lcms.cmsDoTransform(toDevice, labs, count);
        const reproducedLabs = lcms.cmsDoTransform(toLab, device, count);
        const deviceValues = space.displayScale === 1 ? device : device.map((value) => value * space.displayScale);
        return { reproducedLabs, deviceValues };
      },
      deviceToLab(device) {
        assertLive();
        if (device.length % channelCount !== 0) {
          throw new Error(`Device input length must be a multiple of ${channelCount}.`);
        }
        const native =
          space.displayScale === 1 ? device : device.map((value) => value / space.displayScale);
        return lcms.cmsDoTransform(toLab, native, device.length / channelCount);
      },
      dispose: release,
    };
  } catch (error) {
    release();
    throw error;
  }
}
