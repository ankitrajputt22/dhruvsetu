import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { MAX_DATASET_BYTES, MAX_DOCUMENT_BYTES } from "@/lib/researcher";

function bytes(size: unknown): number {
  const match = /^(\d+)(kb|mb|gb)?$/.exec(String(size).toLowerCase());
  if (match === null) {
    throw new Error(`Unknown size: ${String(size)}`);
  }
  const unit = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[match[2] as "kb" | "mb" | "gb"] ?? 1;
  return Number(match[1]) * unit;
}

describe("upload size limits", () => {
  // The site passes API requests on. A body larger than its limit arrives cut
  // short, and the upload then waits until it times out.
  it("lets the largest allowed upload through the site in one piece", () => {
    const passedOn = bytes(nextConfig.experimental?.proxyClientMaxBodySize);
    const formFields = 64 * 1024;

    expect(passedOn).toBeGreaterThanOrEqual(MAX_DOCUMENT_BYTES + formFields);
    expect(passedOn).toBeGreaterThanOrEqual(MAX_DATASET_BYTES + formFields);
  });

  it("uses the limits the API applies", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_DATASET_BYTES).toBe(5 * 1024 * 1024);
  });
});
