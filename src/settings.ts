export const settings = (() => {
  const DISABLE_COMPLETIONS_KEY = "disable-completion";
  const USE_INLINE_COMPLETION_TEXT_IN_SOURCE_KEY = "use-inline-completion-text-in-source";
  const USE_INLINE_COMPLETION_TEXT_IN_PREVIEW_CODE_BLOCKS_KEY =
    "use-inline-completion-text-in-preview-code-blocks";

  const changeListeners = new Map<keyof typeof res, Array<() => void>>();

  const res = {
    get disableCompletions() {
      return (localStorage.getItem(DISABLE_COMPLETIONS_KEY) ?? "false") === "true";
    },
    set disableCompletions(value: boolean) {
      localStorage.setItem(DISABLE_COMPLETIONS_KEY, value ? "true" : "false");
      changeListeners.get("disableCompletions")?.forEach((listener) => listener());
    },

    get useInlineCompletionTextInSource() {
      return (localStorage.getItem(USE_INLINE_COMPLETION_TEXT_IN_SOURCE_KEY) ?? "true") === "true";
    },
    set useInlineCompletionTextInSource(value: boolean) {
      localStorage.setItem(USE_INLINE_COMPLETION_TEXT_IN_SOURCE_KEY, value ? "true" : "false");
      changeListeners.get("useInlineCompletionTextInSource")?.forEach((listener) => listener());
    },

    get useInlineCompletionTextInPreviewCodeBlocks() {
      return (
        (localStorage.getItem(USE_INLINE_COMPLETION_TEXT_IN_PREVIEW_CODE_BLOCKS_KEY) ?? "false") ===
        "true"
      );
    },
    set useInlineCompletionTextInPreviewCodeBlocks(value: boolean) {
      localStorage.setItem(
        USE_INLINE_COMPLETION_TEXT_IN_PREVIEW_CODE_BLOCKS_KEY,
        value ? "true" : "false",
      );
      changeListeners
        .get("useInlineCompletionTextInPreviewCodeBlocks")
        ?.forEach((listener) => listener());
    },
  };

  const onChangeProperty = <K extends keyof typeof res>(
    key: K,
    callback: (value: (typeof res)[K]) => void,
  ) => {
    const listener = () => callback(res[key]);
    if (!changeListeners.has(key)) changeListeners.set(key, []);
    changeListeners.get(key)?.push(listener);
    return () => {
      const listeners = changeListeners.get(key);
      if (!listeners) return;
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  };
  (res as unknown as { onChangeProperty: typeof onChangeProperty }).onChangeProperty =
    onChangeProperty;

  return res as typeof res & { onChangeProperty: typeof onChangeProperty };
})();
