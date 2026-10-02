import { describe, expect, it } from "vitest";
import { validateProfileHeader } from "./profileHeader";

function header(profileClass: string, signature = "acsp") {
  const bytes = new Uint8Array(132);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < 4; index += 1) {
      bytes[offset + index] = text.charCodeAt(index);
    }
  };
  write(12, profileClass);
  write(36, signature);
  return bytes;
}

describe("validateProfileHeader", () => {
  it.each(["prtr", "mntr", "scnr", "spac"])("accepts %s profiles", (profileClass) => {
    expect(validateProfileHeader(header(profileClass))).toBeNull();
  });

  it("rejects files that are too short", () => {
    expect(validateProfileHeader(new Uint8Array(20))).toBe("Not an ICC profile.");
  });

  it("rejects files without the acsp signature", () => {
    expect(validateProfileHeader(header("prtr", "nope"))).toBe("Not an ICC profile.");
  });

  it.each([
    ["link", "Device link profiles are not supported."],
    ["abst", "Abstract profiles are not supported."],
    ["nmcl", "Named color profiles are not supported."],
    ["xxxx", 'Unsupported profile class "xxxx".'],
  ])("rejects %s profiles", (profileClass, message) => {
    expect(validateProfileHeader(header(profileClass))).toBe(message);
  });
});
