/**
 * This function ensures the correct decodings of percent-encoded characters as
 * well as ensuring a cross-platform valid absolute path string.
 *
 * ```javascript
 * import { fileURLToPath } from "@modules/url";
 *
 * const __filename = fileURLToPath(import.meta.url);
 *
 * new URL("file:///C:/path/").pathname;      // Incorrect: /C:/path/
 * fileURLToPath("file:///C:/path/");         // Correct:   C:\path\ (Windows)
 *
 * new URL("file://nas/foo.txt").pathname;    // Incorrect: /foo.txt
 * fileURLToPath("file://nas/foo.txt");       // Correct:   \\nas\foo.txt (Windows)
 *
 * new URL("file:///你好.txt").pathname;      // Incorrect: /%E4%BD%A0%E5%A5%BD.txt
 * fileURLToPath("file:///你好.txt");         // Correct:   /你好.txt (POSIX)
 *
 * new URL("file:///hello world").pathname;   // Incorrect: /hello%20world
 * fileURLToPath("file:///hello world");      // Correct:   /hello world (POSIX)
 * ```
 * @param url The file URL string or URL object to convert to a path.
 * @return The fully-resolved platform-specific Node.js file path.
 */
export const fileURLToPath = (url: string) => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new TypeError(`Invalid URL: ${url}`);
  }

  if (parsedUrl.protocol !== "file:") {
    throw new TypeError(`Invalid URL protocol: ${parsedUrl.protocol}`);
  }

  let path = decodeURIComponent(parsedUrl.pathname);

  if (Files.isWin) {
    // For Windows: replace forward slashes with backslashes and remove the leading slash for local paths
    path = path.replace(/\//g, "\\");

    // Handle local paths like "C:\path"
    if (path.startsWith("\\") && !parsedUrl.host) {
      path = path.slice(1);
    }

    // Handle network paths like "\\nas\foo.txt"
    if (parsedUrl.host) {
      path = `\\\\${parsedUrl.host}${path}`;
    }
  } else {
    // For POSIX: Ensure the leading slash is present
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
  }

  return path;
};

/**
 * This function ensures that `path` is resolved absolutely, and that the URL
 * control characters are correctly encoded when converting into a File URL.
 *
 * ```javascript
 * import { pathToFileURL } from "@modules/url";
 *
 * new URL("/foo#1", "file:");           // Incorrect: file:///foo#1
 * pathToFileURL("/foo#1");              // Correct:   file:///foo%231 (POSIX)
 *
 * new URL("/some/path%.c", "file:");    // Incorrect: file:///some/path%.c
 * pathToFileURL("/some/path%.c");       // Correct:   file:///some/path%25.c (POSIX)
 * ```
 * @param path The path to convert to a File URL.
 * @return The file URL object.
 */
export const pathToFileURL = (path: string) => {
  const url = new URL("file:///");
  url.pathname = encodeURI(path.replace(/\\/g, "/"));
  return url;
};
