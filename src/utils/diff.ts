import diff from "fast-diff";

import type { Range } from "@/types/lsp";

export const computeTextChange = (
  oldStr: string,
  newStr: string,
): Array<{ range: Range; text: string }> => {
  const result: Array<{ range: Range; text: string }> = [];

  const diffs = diff(oldStr, newStr).reverse();

  let line = 0;
  let character = 0;

  let change: { range: Range; text: string } | null = null;

  let part: diff.Diff | undefined;
  while ((part = diffs.pop())) {
    const [operation, text] = part;

    const linesToAdd = text.split("\n").length - 1;

    switch (operation) {
      case diff.EQUAL:
        if (change !== null) {
          result.push(change);
          change = null;
        }
        line += linesToAdd;
        character =
          linesToAdd === 0 ? character + text.length : text.length - text.lastIndexOf("\n") - 1;
        break;

      case diff.DELETE:
        if (change === null) {
          change = {
            range: {
              start: { line, character },
              end: {
                line: line + linesToAdd,
                character:
                  linesToAdd === 0 ?
                    character + text.length
                  : text.length - text.lastIndexOf("\n") - 1,
              },
            },
            text: "",
          };
        } else {
          change.range.end.line += linesToAdd;
          change.range.end.character =
            linesToAdd === 0 ? character + text.length : text.length - text.lastIndexOf("\n") - 1;
        }
        line += linesToAdd;
        character =
          linesToAdd === 0 ? character + text.length : text.length - text.lastIndexOf("\n") - 1;
        break;

      case diff.INSERT:
        if (change === null) {
          change = {
            range: {
              start: { line, character },
              end: { line, character },
            },
            text,
          };
        } else {
          change.text += text;
        }
        break;
    }
  }

  if (change !== null) result.push(change);

  return result;
};
