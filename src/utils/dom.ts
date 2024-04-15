/**
 * Get coordinates of the caret.
 * @returns
 */
export const getCaretCoordinate = (): { x: number; y: number } | null => {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0).cloneRange();
    const caret = document.createElement("span");
    range.insertNode(caret);
    const rect = caret.getBoundingClientRect();
    if (caret.parentNode) caret.parentNode.removeChild(caret);
    return { x: rect.left, y: rect.top };
  }
  return null;
};
