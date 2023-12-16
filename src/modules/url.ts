/**
 * This function ensures that `path` is resolved absolutely, and that the URL
 * control characters are correctly encoded when converting into a File URL.
 *
 * ```javascript
 * import { pathToFileURL } from '@modules/url';
 *
 * new URL('/foo#1', 'file:');           // Incorrect: file:///foo#1
 * pathToFileURL('/foo#1');              // Correct:   file:///foo%231 (POSIX)
 *
 * new URL('/some/path%.c', 'file:');    // Incorrect: file:///some/path%.c
 * pathToFileURL('/some/path%.c');       // Correct:   file:///some/path%25.c (POSIX)
 * ```
 * @param path The path to convert to a File URL.
 * @return The file URL object.
 */
export const pathToFileURL = (path: string) => {
  const url = new URL("file:///");
  url.pathname = encodeURI(path.replace(/\\/g, "/"));
  return url;
};
