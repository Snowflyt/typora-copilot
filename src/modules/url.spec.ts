import { describe, expect, it } from "vitest";

import { fileURLToPath, pathToFileURL } from "./url";

describe("fileURLToPath", () => {
  it("should return a platform-specific path", () => {
    const isWinBefore = (window.File as ExtendedFileConstructor).isWin;

    (window.File as ExtendedFileConstructor).isWin = true;
    expect(fileURLToPath("file:///C:/path/")).toBe("C:\\path\\");
    expect(fileURLToPath("file://nas/foo.txt")).toBe("\\\\nas\\foo.txt");
    (window.File as ExtendedFileConstructor).isWin = false;
    expect(fileURLToPath("file:///你好.txt")).toBe("/你好.txt");
    expect(fileURLToPath("file:///hello world")).toBe("/hello world");

    (window.File as ExtendedFileConstructor).isWin = isWinBefore;
  });
});

describe("pathToFileURL", () => {
  it("should return a file URL object", () => {
    expect(pathToFileURL("/foo#1")).toEqual(new URL("file:///foo%231"));
    expect(pathToFileURL("/some/path%.c")).toEqual(new URL("file:///some/path%25.c"));
    expect(pathToFileURL("C:\\foo\\bar\\test.py")).toEqual(new URL("file:///C:/foo/bar/test.py"));
  });
});
