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
  /** Device → Lab with LittleCMS float units (0–100 ink, 0–1 RGB). Used for calibration and tests. */
  deviceToLab: (device: Float32Array) => Float32Array;
  dispose: () => void;
};

export function createProfileEngine(lcms: LcmsModule, bytes: Uint8Array): ProfileEngine {
  const headerError = validateProfileHeader(bytes);
  if (headerError) {
    throw new Error(headerError);
  }

  const profile = lcms.cmsOpenProfileFromMem(bytes, bytes.byteLength);
  if (!profile) {
    throw new Error("LittleCMS could not read this profile.");
  }

  const labProfile = lcms.cmsCreateLab4Profile(null);
  const transforms: number[] = [];
  const release = () => {
    transforms.forEach((transform) => lcms.cmsDeleteTransform(transform));
    lcms.cmsCloseProfile(profile);
    lcms.cmsCloseProfile(labProfile);
  };

  const labFormat = lcms.cmsFormatterForColorspaceOfProfile(labProfile, 4, true);
  const deviceFormat = lcms.cmsFormatterForColorspaceOfProfile(profile, 4, true);
  const space = describeColorSpace(T_COLORSPACE(deviceFormat));
  if (!space) {
    release();
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
  const toLab = lcms.cmsCreateTransform(profile, deviceFormat, labProfile, labFormat, INTENT_ABSOLUTE_COLORIMETRIC, 0);
  [toDevice, toLab].forEach((transform) => {
    if (transform) {
      transforms.push(transform);
    }
  });
  if (!toDevice || !toLab) {
    release();
    throw new Error("This profile can't convert Lab → device → Lab (missing A2B or B2A table).");
  }

  const name =
    lcms.cmsGetProfileInfoASCII(profile, cmsInfoDescription, "en", "US").replace(/\0/g, "").trim() ||
    "Untitled profile";

  return {
    info: { name, colorSpace: space.colorSpace, channelNames: space.channelNames },
    roundTrip(labs) {
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
      return lcms.cmsDoTransform(toLab, device, device.length / space.channelNames.length);
    },
    dispose: release,
  };
}
