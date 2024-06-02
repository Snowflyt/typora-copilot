export const settings = (() => {
  const USE_INLINE_COMPLETION_TEXT_IN_SOURCE_KEY = "use-inline-completion-text-in-source";
  const USE_INLINE_COMPLETION_TEXT_IN_PREVIEW_CODE_BLOCKS_KEY =
    "use-inline-completion-text-in-preview-code-blocks";

  return {
    get useInlineCompletionTextInSource() {
      return (localStorage.getItem(USE_INLINE_COMPLETION_TEXT_IN_SOURCE_KEY) ?? "true") === "true";
    },
    set useInlineCompletionTextInSource(value: boolean) {
      localStorage.setItem(USE_INLINE_COMPLETION_TEXT_IN_SOURCE_KEY, value ? "true" : "false");
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
    },
  };
})();
