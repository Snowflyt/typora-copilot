import { afterAll, describe, expect, it, vi } from "vitest";

import { t } from "./t";

vi.mock("./en.json", () => ({ default: { a: { b: { c: "foo" } } } }));

describe("t", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  afterAll(() => {
    warn.mockReset();
  });

  it("should return the correct translation", () => {
    expect(t("a.b.c" as never)).toBe("foo");
  });

  it("should warn when the translation is not found", () => {
    expect(t("d" as never)).toBe("d");
    expect(warn).toHaveBeenCalledWith('Cannot find translation for "d": "d" not found.');
    warn.mockClear();

    expect(t("d.c" as never)).toBe("d.c");
    expect(warn).toHaveBeenCalledWith('Cannot find translation for "d.c": "d" not found.');
    warn.mockClear();

    expect(t("a.d.c" as never)).toBe("a.d.c");
    expect(warn).toHaveBeenCalledWith('Cannot find translation for "a.d.c": "d" not found in "a".');
    warn.mockClear();

    expect(t("a.b.c.d" as never)).toBe("a.b.c.d");
    expect(warn).toHaveBeenCalledWith(
      'Cannot find translation for "a.b.c.d": "a.b.c" is not an object.',
    );
    warn.mockClear();

    expect(t("" as never)).toBe("");
    expect(warn).toHaveBeenCalledWith("Empty path is not allowed.");
    warn.mockClear();

    expect(t("a.b.d" as never)).toBe("a.b.d");
    expect(warn).toHaveBeenCalledWith(
      'Cannot find translation for "a.b.d": "d" not found in "a.b".',
    );
    warn.mockClear();

    expect(t("a.b" as never)).toBe("a.b");
    expect(warn).toHaveBeenCalledWith('Cannot find translation for "a.b": "a.b" is not a string.');
    warn.mockClear();
  });
});
