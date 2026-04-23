// esbuild's `inject` bundles this file into the output, then rewrites every
// bare `Buffer` reference in the bundle to import { Buffer } from here.
// The side-effect assignment also seeds globalThis.Buffer for any code that
// reads it off the global object instead of as a free identifier.
import { Buffer as __PBBuffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = __PBBuffer;
}
if (typeof globalThis.process === "undefined") {
  globalThis.process = { env: {} };
}

export const Buffer = __PBBuffer;
