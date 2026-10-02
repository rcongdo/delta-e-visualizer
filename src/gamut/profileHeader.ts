const HEADER_SIZE = 132;
const SUPPORTED_CLASSES = new Set(["prtr", "mntr", "scnr", "spac"]);
const UNSUPPORTED_CLASS_MESSAGES: Record<string, string> = {
  link: "Device link profiles are not supported.",
  abst: "Abstract profiles are not supported.",
  nmcl: "Named color profiles are not supported.",
};

const readSignature = (bytes: Uint8Array, offset: number) =>
  String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);

/** Returns an error message, or null when the header looks like a usable ICC profile. */
export function validateProfileHeader(bytes: Uint8Array): string | null {
  if (bytes.byteLength < HEADER_SIZE || readSignature(bytes, 36) !== "acsp") {
    return "Not an ICC profile.";
  }

  const profileClass = readSignature(bytes, 12);
  if (SUPPORTED_CLASSES.has(profileClass)) {
    return null;
  }

  return UNSUPPORTED_CLASS_MESSAGES[profileClass] ?? `Unsupported profile class "${profileClass}".`;
}
