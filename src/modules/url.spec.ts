import { describe, expect, it } from "vitest";

import { pathToFileURL } from "./url";

describe("pathToFileURL", () => {
  it("should return a file URL object", () => {
    expect(pathToFileURL("/foo#1")).toEqual(new URL("file:///foo%231"));
    expect(pathToFileURL("/some/path%.c")).toEqual(new URL("file:///some/path%25.c"));
    expect(pathToFileURL("C:\\foo\\bar\\test.py")).toEqual(new URL("file:///C:/foo/bar/test.py"));
  });
});
