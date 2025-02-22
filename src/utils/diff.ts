import diff from "fast-diff";

import type { Range } from "@/types/lsp";

export const computeTextChanges = (
  oldStr: string,
  newStr: string,
  lastCaretPosition?: { line: number; character: number } | null,
): { range: Range; text: string }[] => {
  const result: { range: Range; text: string }[] = [];

  const diffs = diff(
    oldStr,
    newStr,
    lastCaretPosition ?
      oldStr
        .split(Files.useCRLF ? "\r\n" : "\n")
        .slice(0, lastCaretPosition.line)
        .reduce((acc, line) => acc + line.length + (Files.useCRLF ? 2 : 1), 0) +
        lastCaretPosition.character
    : 0,
    true,
  ).reverse();

  let line = 0;
  let character = 0;

  let change: { range: Range; text: string } | null = null;

  let part: diff.Diff | undefined;
  while ((part = diffs.pop())) {
    const [operation, text] = part;

    const linesToAdd = text.split(Files.useCRLF ? "\r\n" : "\n").length - 1;

    switch (operation) {
      case diff.EQUAL:
        if (change !== null) {
          result.push(change);
          change = null;
        }
        line += linesToAdd;
        character =
          linesToAdd === 0 ?
            character + text.length
          : text.length - text.lastIndexOf(Files.useCRLF ? "\r\n" : "\n") - 1;
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
                  : text.length - text.lastIndexOf(Files.useCRLF ? "\r\n" : "\n") - 1,
              },
            },
            text: "",
          };
        } else {
          change.range.end.line += linesToAdd;
          change.range.end.character =
            linesToAdd === 0 ?
              character + text.length
            : text.length - text.lastIndexOf(Files.useCRLF ? "\r\n" : "\n") - 1;
        }
        line += linesToAdd;
        character =
          linesToAdd === 0 ?
            character + text.length
          : text.length - text.lastIndexOf(Files.useCRLF ? "\r\n" : "\n") - 1;
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
