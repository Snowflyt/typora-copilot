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

/**
 * Get the CSS styles of the given class names.
 * @param classNames The CSS class names.
 * @returns
 */
export const getCSSClassStyles = (() => {
  const cachedElements = new Map<string, HTMLDivElement>();

  const createElementWithClasses = (classNames: string[]): HTMLDivElement => {
    const element = document.createElement("div");
    element.style.height = "0";
    element.style.width = "0";
    element.style.position = "absolute";
    element.style.left = "0";
    element.style.top = "0";
    element.classList.add(...classNames);
    return element;
  };

  return (...classNames: string[]): CSSStyleDeclaration => {
    const key = classNames.join(" ");
    if (cachedElements.has(key)) return window.getComputedStyle(cachedElements.get(key)!);
    const element = createElementWithClasses(classNames);
    document.body.appendChild(element);
    cachedElements.set(key, element);
    return window.getComputedStyle(element);
  };
})();
