declare global {
  interface JQuery<TElement> {
    once<TType extends string>(
      events: TType,
      handler: JQuery.TypeEventHandler<TElement, undefined, TElement, TElement, TType>,
    ): this;
  }
}

$(function () {
  $.fn.once = function (events, handler) {
    return this.each(function () {
      const _handler: JQuery.EventHandler<HTMLElement> = function (event) {
        $(this).off(events, _handler);
        handler.call(this, event);
      };
      $(this).on(events, _handler);
    });
  };

  /*****************
   * Custom events *
   *****************/

  /* caretMove */
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

    // Separate caretMove event handlers for each target
    const onCaretMoveFunctions = new WeakMap<EventTarget, (event: Event) => void>();

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

        onCaretMoveFunctions.set(this, onCaretMove);

        for (const event of eventsToBind) this.addEventListener(event, onCaretMove, true);
      },
      teardown() {
        const onCaretMove = onCaretMoveFunctions.get(this);
        if (!onCaretMove) return;
        for (const event of eventsToBind) this.removeEventListener(event, onCaretMove, true);
      },
    };
  })();
});

export {};
