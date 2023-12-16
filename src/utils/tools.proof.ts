import { describe, expect, it } from "typroof";

import { omit } from "./tools";

describe("omit", () => {
  it("should omit keys from an object", () => {
    expect(omit({ a: 1, b: 2, c: 3 }, "a")).toBe<{ b: number; c: number }>();
    expect(omit({ a: 1, b: 2, c: 3 }, "a", "c")).toBe<{ b: number }>();
  });
});
