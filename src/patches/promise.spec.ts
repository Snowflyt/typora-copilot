import { describe, expect, it } from "vitest";

import "./promise";

// Utility to simulate delays
const delay = (ms: number, value?: unknown, shouldReject = false) =>
  new Promise((resolve, reject) =>
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    setTimeout(() => (shouldReject ? reject(value) : resolve(value)), ms),
  );

// Main tests
describe("Promise.orderedFirstResolved", () => {
  it("should return the first resolved promise in order", async () => {
    const promises = [delay(100, "A"), delay(200, "B"), delay(300, "C")];
    const result = await Promise.orderedFirstResolved(promises);
    expect(result).toBe("A");
  });

  it("should return the second resolved promise if the first is rejected", async () => {
    const promises = [delay(100, "Error A", true), delay(200, "B"), delay(300, "C")];
    const result = await Promise.orderedFirstResolved(promises);
    expect(result).toBe("B");
  });

  it("should reject if all promises are rejected", async () => {
    const promises = [
      delay(100, "Error A", true),
      delay(200, "Error B", true),
      delay(300, "Error C", true),
    ];
    await expect(Promise.orderedFirstResolved(promises)).rejects.toThrow(
      "All promises were rejected",
    );
  });

  it("should reject if the iterable is empty", async () => {
    const promises: Promise<string>[] = [];
    await expect(Promise.orderedFirstResolved(promises)).rejects.toThrow(
      "All promises were rejected",
    );
  });

  it("should return the first resolved value in order even if others resolve first", async () => {
    const promises = [delay(300, "A"), delay(100, "B"), delay(200, "C")];
    const result = await Promise.orderedFirstResolved(promises);
    expect(result).toBe("A");
  });

  it("should handle mixed resolutions and rejections correctly", async () => {
    const promises = [
      delay(300, "A"), // First resolves after 300ms
      delay(100, "Error B", true), // Second rejects first
      delay(200, "C"), // Third resolves but is irrelevant
    ];
    const result = await Promise.orderedFirstResolved(promises);
    expect(result).toBe("A");
  });
});
