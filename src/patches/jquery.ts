/************************
 * Custom jQuery events *
 ************************/
$(function () {
  /*************
   * caretMove *
   *************/
  (() => {
    /**
     * Get the current caret position.
     * @returns
     */
    const getCaretPosition = (): { node: Node; offset: number } | null => {
      const selection = window.getSelection();
      if (selection === null) return null;
      if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        return {
          node: range.startContainer,
          offset: range.startOffset,
        };
      }
      return null;
    };

    const eventsToBind = [
      "keypress",
      "keyup",
      "keydown",
      "mouseup",
      "mousedown",
      "mousemove",
      "touchend",
      "touchstart",
      "touchmove",
      "focus",
      "blur",
      "input",
      "paste",
      "cut",
      "copy",
      "select",
      "selectstart",
      "selectionchange",
      "drag",
      "dragend",
      "dragenter",
      "dragexit",
      "dragleave",
      "dragover",
      "dragstart",
      "drop",
      "scroll",
      "wheel",
      "animationstart",
      "animationend",
      "animationiteration",
      "transitionstart",
      "transitionend",
      "transitionrun",
      "transitioncancel",
    ];

    $.event.special.caretMove = {
      setup() {
        let lastCaretPosition = getCaretPosition();
        const onCaretMove = (event: Event) => {
          const selection = window.getSelection();

          if (selection === null) {
            if (lastCaretPosition !== null) {
              lastCaretPosition = null;
              if (event.target) $(event.target).trigger("caretMove", [null]);
              return;
            }
            return;
          }

          if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            const caretPosition = {
              node: range.startContainer,
              offset: range.startOffset,
            };

            if (
              !lastCaretPosition ||
              !lastCaretPosition.node.isSameNode(caretPosition.node) ||
              caretPosition.offset !== lastCaretPosition.offset
            ) {
              lastCaretPosition = caretPosition;
              if (event.target) $(event.target).trigger("caretMove", [caretPosition]);
            }
          }
        };

        $.data(this, "caretMoveHandler", onCaretMove);

        for (const event of eventsToBind) this.addEventListener(event, onCaretMove, true);

        return false;
      },
      teardown() {
        const onCaretMove = $.data(this, "caretMoveHandler");
        if (!onCaretMove) return false;
        for (const event of eventsToBind) this.removeEventListener(event, onCaretMove, true);
        $.removeData(this, "caretMoveHandler");
      },
    };
  })();
});

export {};
