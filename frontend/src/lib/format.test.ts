import { describe, expect, it } from "vitest";

import {
  formatDataValue,
  formatDateRange,
  formatNumber,
  formatPlainNumber,
} from "@/lib/format";

describe("values from a data file", () => {
  it("are shown as the file has them, without rounding or separators", () => {
    expect(formatDataValue(2016)).toBe("2016");
    expect(formatDataValue(0.14452)).toBe("0.14452");
    expect(formatDataValue(0.039256)).toBe("0.039256");
    expect(formatDataValue(-17.713)).toBe("-17.713");
  });

  it("keep calculated values apart: rounded, and plain beside file values", () => {
    expect(formatPlainNumber(1895)).toBe("1895");
    expect(formatPlainNumber(-17.760880658436214)).toBe("-17.7609");
    // Counts of rows keep the separator.
    expect(formatNumber(12345)).toBe("12,345");
  });
});

describe("expedition dates", () => {
  it("says so when a source gives only the start", () => {
    expect(formatDateRange("2024-05-20", null)).toBe("From May 20, 2024");
    expect(formatDateRange(null, "2025-03-31")).toBe("Until Mar 31, 2025");
    expect(formatDateRange(null, null)).toBe("Dates not listed");
    expect(formatDateRange("2024-05-20", "2025-03-31")).toBe("May 20, 2024 – Mar 31, 2025");
  });
});
