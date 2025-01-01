import type path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AddSep<F extends (...args: any) => unknown> = (
  sep: string,
  ...args: Parameters<F>
) => ReturnType<F>;

export const sep = Files.isWin ? "\\" : "/";
export const delimiter = Files.isWin ? ";" : ":";

const assertPath = (path: unknown) => {
  if (typeof path !== "string")
    throw new TypeError("Path must be a string. Received " + JSON.stringify(path));
};

/**
 * Resolves `.` and `..` elements in a path with directory names
 */
const normalizeStringPosix = (sep: string, path: string, allowAboveRoot: boolean) => {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i);
    else if (code === sep.charCodeAt(0) /*/*/) break;
    else code = sep.charCodeAt(0) /*/*/;
    if (code === sep.charCodeAt(0) /*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.charCodeAt(res.length - 1) !== 46 /*.*/ ||
          res.charCodeAt(res.length - 2) !== 46 /*.*/
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(sep);
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = "";
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf(sep);
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) res += sep + "..";
          else res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) res += sep + path.slice(lastSlash + 1, i);
        else res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 /*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
};

export const __format = (sep: string, pathObject: path.FormatInputPathObject) => {
  const dir = pathObject.dir || pathObject.root;
  const base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
};

/**
 * The right-most parameter is considered {to}. Other parameters are considered an array of {from}.
 *
 * Starting from leftmost {from} parameter, resolves {to} to an absolute path.
 *
 * If {to} isn't already absolute, {from} arguments are prepended in right to left order,
 * until an absolute path is found. If after using all {from} paths still no absolute path is found,
 * the current working directory is used as well. The resulting path is normalized,
 * and trailing slashes are removed unless the path gets resolved to the root directory.
 *
 * @param paths A sequence of paths or path segments.
 * @throws {TypeError} if any of the arguments is not a string.
 */
export const resolve: typeof path.posix.resolve = (...args) => _resolve(sep, ...args);

export const _resolve: AddSep<typeof path.posix.resolve> = (sep, ...paths) => {
  let resolvedPath = "";
  let resolvedAbsolute = false;
  let cwd;

  for (let i = paths.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    let path: string;
    if (i >= 0) path = paths[i]!;
    else {
      if (cwd === undefined) cwd = process.cwd();
      path = cwd;
    }

    assertPath(path);

    // Skip empty entries
    if (path.length === 0) {
      continue;
    }

    resolvedPath = path + sep + resolvedPath;
    resolvedAbsolute = path.charCodeAt(0) === sep.charCodeAt(0) /*/*/;
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeStringPosix(sep, resolvedPath, !resolvedAbsolute);

  if (resolvedAbsolute) {
    if (resolvedPath.length > 0) return sep + resolvedPath;
    else return sep;
  } else if (resolvedPath.length > 0) {
    return resolvedPath;
  } else {
    return ".";
  }
};

/**
 * Normalize a string path, reducing `".."` and `"."` parts.
 * When multiple slashes are found, they're replaced by a single one; when the path contains a
 * trailing slash, it is preserved. On Windows backslashes are used.
 *
 * @param path string path to normalize.
 * @throws {TypeError} if `path` is not a string.
 */
export const normalize: typeof path.posix.normalize = (...args) => _normalize(sep, ...args);
export const _normalize: AddSep<typeof path.posix.normalize> = (sep, path) => {
  assertPath(path);

  if (path.length === 0) return ".";

  const isAbsolute = path.charCodeAt(0) === sep.charCodeAt(0); /*/*/
  const trailingSeparator = path.charCodeAt(path.length - 1) === sep.charCodeAt(0); /*/*/

  // Normalize the path
  path = normalizeStringPosix(sep, path, !isAbsolute);

  if (path.length === 0 && !isAbsolute) path = ".";
  if (path.length > 0 && trailingSeparator) path += sep;

  if (isAbsolute) return sep + path;
  return path;
};

/**
 * Determines whether `path` is an absolute path. An absolute path will always resolve to the same
 * location, regardless of the working directory.
 *
 * If the given `path` is a zero-length string, `false` will be returned.
 *
 * @param path path to test.
 * @throws {TypeError} if `path` is not a string.
 */
export const isAbsolute: typeof path.posix.isAbsolute = (...args) => _isAbsolute(sep, ...args);
export const _isAbsolute: AddSep<typeof path.posix.isAbsolute> = (sep, path) => {
  assertPath(path);
  return path.length > 0 && path.charCodeAt(0) === sep.charCodeAt(0) /*/*/;
};

/**
 * Join all arguments together and normalize the resulting path.
 *
 * @param paths paths to join.
 * @throws {TypeError} if any of the path segments is not a string.
 */
export const join: typeof path.posix.join = (...args) => _join(sep, ...args);
export const _join: AddSep<typeof path.join> = (sep, ...paths) => {
  if (paths.length === 0) return ".";
  let joined;
  for (let i = 0; i < paths.length; ++i) {
    const arg = paths[i]!;
    assertPath(arg);
    if (arg.length > 0) {
      if (joined === undefined) joined = arg;
      else joined += sep + arg;
    }
  }
  if (joined === undefined) return ".";
  return _normalize(sep, joined);
};

/**
 * Solve the relative path from {from} to {to} based on the current working directory.
 * At times we have two absolute paths, and we need to derive the relative path from one to the
 * other. This is actually the reverse transform of path.resolve.
 *
 * @throws {TypeError} if either `from` or `to` is not a string.
 */
export const relative: typeof path.posix.relative = (...args) => _relative(sep, ...args);
export const _relative: AddSep<typeof path.posix.relative> = (sep, from, to) => {
  assertPath(from);
  assertPath(to);

  if (from === to) return "";

  from = _resolve(sep, from);
  to = _resolve(sep, to);

  if (from === to) return "";

  // Trim any leading backslashes
  let fromStart = 1;
  for (; fromStart < from.length; ++fromStart) {
    if (from.charCodeAt(fromStart) !== sep.charCodeAt(0) /*/*/) break;
  }
  const fromEnd = from.length;
  const fromLen = fromEnd - fromStart;

  // Trim any leading backslashes
  let toStart = 1;
  for (; toStart < to.length; ++toStart) {
    if (to.charCodeAt(toStart) !== sep.charCodeAt(0) /*/*/) break;
  }
  const toEnd = to.length;
  const toLen = toEnd - toStart;

  // Compare paths to find the longest common path from root
  const length = fromLen < toLen ? fromLen : toLen;
  let lastCommonSep = -1;
  let i = 0;
  for (; i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === sep.charCodeAt(0) /*/*/) {
          // We get here if `from` is the exact base path for `to`.
          // For example: from='/foo/bar'; to='/foo/bar/baz'
          return to.slice(toStart + i + 1);
        } else if (i === 0) {
          // We get here if `from` is the root
          // For example: from='/'; to='/foo'
          return to.slice(toStart + i);
        }
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === sep.charCodeAt(0) /*/*/) {
          // We get here if `to` is the exact base path for `from`.
          // For example: from='/foo/bar/baz'; to='/foo/bar'
          lastCommonSep = i;
        } else if (i === 0) {
          // We get here if `to` is the root.
          // For example: from='/foo'; to='/'
          lastCommonSep = 0;
        }
      }
      break;
    }
    const fromCode = from.charCodeAt(fromStart + i);
    const toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode) break;
    else if (fromCode === sep.charCodeAt(0) /*/*/) lastCommonSep = i;
  }

  let out = "";
  // Generate the relative path based on the path difference between `to`
  // and `from`
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
    if (i === fromEnd || from.charCodeAt(i) === sep.charCodeAt(0) /*/*/) {
      if (out.length === 0) out += "..";
      else out += sep + "..";
    }
  }

  // Lastly, append the rest of the destination (`to`) path that comes after
  // the common path parts
  if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
  else {
    toStart += lastCommonSep;
    if (to.charCodeAt(toStart) === sep.charCodeAt(0) /*/*/) ++toStart;
    return to.slice(toStart);
  }
};

/**
 * Return the directory name of a path. Similar to the Unix dirname command.
 *
 * @param path the path to evaluate.
 * @throws {TypeError} if `path` is not a string.
 */
export const dirname: typeof path.dirname = (...args) => _dirname(sep, ...args);
export const _dirname: AddSep<typeof path.dirname> = (sep, path) => {
  assertPath(path);
  if (path.length === 0) return ".";
  let code = path.charCodeAt(0);
  const hasRoot = code === sep.charCodeAt(0); /*/*/
  let end = -1;
  let matchedSlash = true;
  for (let i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === sep.charCodeAt(0) /*/*/) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? sep : ".";
  if (hasRoot && end === 1) return sep + sep;
  return path.slice(0, end);
};

/**
 * Return the last portion of a path. Similar to the Unix basename command.
 * Often used to extract the file name from a fully qualified path.
 *
 * @param path the path to evaluate.
 * @param suffix optionally, an extension to remove from the result.
 * @throws {TypeError} if `path` is not a string or if `ext` is given and is not a string.
 */
export const basename: typeof path.basename = (...args) => _basename(sep, ...args);
export const _basename: AddSep<typeof path.basename> = (sep, path, ext) => {
  if (ext !== undefined && typeof ext !== "string")
    throw new TypeError('"ext" argument must be a string');
  assertPath(path);

  let start = 0;
  let end = -1;
  let matchedSlash = true;
  let i;

  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path) return "";
    let extIdx = ext.length - 1;
    let firstNonSlashEnd = -1;
    for (i = path.length - 1; i >= 0; --i) {
      const code = path.charCodeAt(i);
      if (code === sep.charCodeAt(0) /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else {
        if (firstNonSlashEnd === -1) {
          // We saw the first non-path separator, remember this index in case
          // we need it if the extension ends up not matching
          matchedSlash = false;
          firstNonSlashEnd = i + 1;
        }
        if (extIdx >= 0) {
          // Try to match the explicit extension
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1) {
              // We matched the extension, so mark this as the end of our path
              // component
              end = i;
            }
          } else {
            // Extension does not match, so our result is the entire path
            // component
            extIdx = -1;
            end = firstNonSlashEnd;
          }
        }
      }
    }

    if (start === end) end = firstNonSlashEnd;
    else if (end === -1) end = path.length;
    return path.slice(start, end);
  } else {
    for (i = path.length - 1; i >= 0; --i) {
      if (path.charCodeAt(i) === sep.charCodeAt(0) /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // path component
        matchedSlash = false;
        end = i + 1;
      }
    }

    if (end === -1) return "";
    return path.slice(start, end);
  }
};

/**
 * Return the extension of the path, from the last `"."` to end of string in the last portion of the
 * path. If there is no `"."`  in the last portion of the path or the first character of it is
 * `"."`, then it returns an empty string.
 *
 * @param path the path to evaluate.
 * @throws {TypeError} if `path` is not a string.
 */
export const extname: typeof path.extname = (...args) => _extname(sep, ...args);
export const _extname: AddSep<typeof path.extname> = (sep, path) => {
  assertPath(path);
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  let preDotState = 0;
  for (let i = path.length - 1; i >= 0; --i) {
    const code = path.charCodeAt(i);
    if (code === sep.charCodeAt(0) /*/*/) {
      // If we reached a path separator that was not part of a set of path
      // separators at the end of the string, stop now
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
      // If this is our first dot, mark it as the start of our extension
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (
    startDot === -1 ||
    end === -1 ||
    // We saw a non-dot character immediately before the dot
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly '..'
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
  ) {
    return "";
  }
  return path.slice(startDot, end);
};

/**
 * Returns a path string from an object - the opposite of `parse()`.
 *
 * @param pathObject path to evaluate.
 */
export const format: typeof path.format = (...args) => _format(sep, ...args);
export const _format: AddSep<typeof path.format> = (sep, pathObject) => {
  if (pathObject === null || typeof pathObject !== "object") {
    throw new TypeError(
      'The "pathObject" argument must be of type Object. Received type ' + typeof pathObject,
    );
  }
  return __format(sep, pathObject);
};

/**
 * Returns an object from a path string - the opposite of `format()`.
 *
 * @param path path to evaluate.
 * @throws {TypeError} if `path` is not a string.
 */
export const parse: typeof path.parse = (...args) => _parse(sep, ...args);
export const _parse: AddSep<typeof path.parse> = (sep, path) => {
  assertPath(path);

  const ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0) return ret;
  let code = path.charCodeAt(0);
  const isAbsolute = code === sep.charCodeAt(0); /*/*/
  let start;
  if (isAbsolute) {
    ret.root = sep;
    start = 1;
  } else {
    start = 0;
  }
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  let i = path.length - 1;

  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  let preDotState = 0;

  // Get non-dir info
  for (; i >= start; --i) {
    code = path.charCodeAt(i);
    if (code === sep.charCodeAt(0) /*/*/) {
      // If we reached a path separator that was not part of a set of path
      // separators at the end of the string, stop now
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
      // If this is our first dot, mark it as the start of our extension
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (
    startDot === -1 ||
    end === -1 ||
    // We saw a non-dot character immediately before the dot
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly '..'
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
  ) {
    if (end !== -1) {
      if (startPart === 0 && isAbsolute) ret.base = ret.name = path.slice(1, end);
      else ret.base = ret.name = path.slice(startPart, end);
    }
  } else {
    if (startPart === 0 && isAbsolute) {
      ret.name = path.slice(1, startDot);
      ret.base = path.slice(1, end);
    } else {
      ret.name = path.slice(startPart, startDot);
      ret.base = path.slice(startPart, end);
    }
    ret.ext = path.slice(startDot, end);
  }

  if (startPart > 0) ret.dir = path.slice(0, startPart - 1);
  else if (isAbsolute) ret.dir = sep;

  return ret;
};

export const win32 = {
  sep: "\\",
  delimiter: ";",
  resolve: (...args: Parameters<typeof resolve>) => _resolve("\\", ...args),
  normalize: (...args: Parameters<typeof normalize>) => _normalize("\\", ...args),
  isAbsolute: (...args: Parameters<typeof isAbsolute>) => _isAbsolute("\\", ...args),
  join: (...args: Parameters<typeof join>) => _join("\\", ...args),
  relative: (...args: Parameters<typeof relative>) => _relative("\\", ...args),
  dirname: (...args: Parameters<typeof dirname>) => _dirname("\\", ...args),
  basename: (...args: Parameters<typeof basename>) => _basename("\\", ...args),
  extname: (...args: Parameters<typeof extname>) => _extname("\\", ...args),
  format: (...args: Parameters<typeof format>) => _format("\\", ...args),
  parse: (...args: Parameters<typeof parse>) => _parse("\\", ...args),
};

export const posix = {
  sep: "/",
  delimiter: ":",
  resolve: (...args: Parameters<typeof resolve>) => _resolve("/", ...args),
  normalize: (...args: Parameters<typeof normalize>) => _normalize("/", ...args),
  isAbsolute: (...args: Parameters<typeof isAbsolute>) => _isAbsolute("/", ...args),
  join: (...args: Parameters<typeof join>) => _join("/", ...args),
  relative: (...args: Parameters<typeof relative>) => _relative("/", ...args),
  dirname: (...args: Parameters<typeof dirname>) => _dirname("/", ...args),
  basename: (...args: Parameters<typeof basename>) => _basename("/", ...args),
  extname: (...args: Parameters<typeof extname>) => _extname("/", ...args),
  format: (...args: Parameters<typeof format>) => _format("/", ...args),
  parse: (...args: Parameters<typeof parse>) => _parse("/", ...args),
};
