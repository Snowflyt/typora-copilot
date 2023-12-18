import { describe, expect, it } from "vitest";

import * as path from "./path";

describe("basename", () => {
  it("should return the last portion of a path", () => {
    expect(path.basename("/foo/bar/baz/asdf/quux.html")).toBe("quux.html");
    expect(path.basename("/foo/bar/baz/asdf/quux.html", ".html")).toBe("quux");
    expect(path.basename("/foo")).toBe("foo");
    expect(path.basename("")).toBe("");
    expect(path.basename("C:\\")).toBe("C:\\");
  });
});

describe("dirname", () => {
  it("should return the directory name of a path", () => {
    expect(path.dirname("/foo/bar/baz/asdf/quux")).toBe("/foo/bar/baz/asdf");
    expect(path.dirname("/foo/bar/baz/asdf/quux.html")).toBe("/foo/bar/baz/asdf");
    expect(path.dirname("/foo/bar/baz/asdf/quux/")).toBe("/foo/bar/baz/asdf");
    expect(path.dirname("/foo/bar")).toBe("/foo");
    expect(path.dirname("/foo")).toBe("/");
    expect(path.dirname("/")).toBe("/");
  });
});
