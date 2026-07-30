import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

// RTL doesn't unmount components between tests on its own unless Vitest's
// globals mode is on (it isn't here). Only relevant under jsdom — there's no
// `document` at all in the node-environment tests (crypto.ts/api.ts).
if (typeof document !== "undefined") {
  afterEach(() => {
    cleanup();
  });
}

// jsdom doesn't implement matchMedia. useTheme calls it on every mount
// (the default theme is "system" until something's been stored), so almost
// any component test that renders ThemeToggle needs this in place.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// Node 22.18 (this project's pinned version) doesn't yet implement the
// Uint8Array base64 methods that every evergreen browser ships. crypto.ts
// only ever runs in the browser in production; this shim exists purely so
// its tests can run under Vitest's Node environment. Built on atob/btoa
// (the older base64 primitives) rather than Buffer, so it works with
// nothing more than this project's existing DOM lib types.

type ToBase64Options = {
  alphabet?: "base64" | "base64url";
  omitPadding?: boolean;
};
type FromBase64Options = { alphabet?: "base64" | "base64url" };

function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function binaryStringToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

if (typeof Uint8Array.prototype.toBase64 !== "function") {
  Object.defineProperty(Uint8Array.prototype, "toBase64", {
    value: function (this: Uint8Array, options?: ToBase64Options): string {
      let encoded = btoa(bytesToBinaryString(this));
      if (options?.alphabet === "base64url") {
        encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_");
      }
      if (options?.omitPadding) {
        encoded = encoded.replace(/=+$/, "");
      }
      return encoded;
    },
    writable: true,
    configurable: true,
  });
}

if (typeof Uint8Array.fromBase64 !== "function") {
  Object.defineProperty(Uint8Array, "fromBase64", {
    value: (base64: string, options?: FromBase64Options): Uint8Array => {
      let normalized = base64;
      if (options?.alphabet === "base64url") {
        normalized = normalized.replace(/-/g, "+").replace(/_/g, "/");
      }
      while (normalized.length % 4 !== 0) normalized += "=";
      return binaryStringToBytes(atob(normalized));
    },
    writable: true,
    configurable: true,
  });
}
