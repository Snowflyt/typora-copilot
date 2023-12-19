import type * as H from "hotscript";

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

export const $S: {
  <T extends string>(selector: T): EnhanceElement<ElementFromSelector<T>> | null;
  <Element extends HTMLElement>(element: Element): EnhanceElement<Element>;
} = (selectorOrElement: string | HTMLElement) => {
  const el =
    typeof selectorOrElement === "string"
      ? document.querySelector(selectorOrElement)
      : selectorOrElement;
  if (el === null) return null;

  const enhanced = el as EnhanceElement<HTMLElement>;

  const _eventHandlers = new Map<
    keyof GeneralEventMap,
    Array<EventHandler<GeneralEventMap, keyof GeneralEventMap>>
  >();

  enhanced.on = <EventName extends keyof GeneralEventMap>(
    event: EventName,
    handler: EventHandler<GeneralEventMap, EventName>,
  ) => {
    if (!_eventHandlers.has(event)) _eventHandlers.set(event, []);
    _eventHandlers.get(event)!.push(handler as never);
  };
  enhanced.off = <EventName extends keyof GeneralEventMap>(
    event: EventName,
    handler: EventHandler<GeneralEventMap, EventName>,
  ) => {
    if (!_eventHandlers.has(event)) return;
    const handlers = _eventHandlers.get(event)!;
    if (!handlers.includes(handler as never)) return;
    handlers.splice(handlers.indexOf(handler as never), 1);
  };
  enhanced.once = <EventName extends keyof GeneralEventMap>(
    event: EventName,
    handler: EventHandler<GeneralEventMap, EventName>,
  ) => {
    const onceHandler = (...args: unknown[]) => {
      enhanced.off(event, onceHandler);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      void handler(...(args as any));
    };
    enhanced.on(event, onceHandler);
  };

  let lastCaretPosition: { node: Node; offset: number } | null = (() => {
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
  })();
  const onCaretMove = () => {
    const selection = window.getSelection();

    const handlers = _eventHandlers.get("caretMove") ?? [];

    if (selection === null) {
      if (lastCaretPosition !== null) {
        lastCaretPosition = null;
        handlers.forEach((handler) => void handler(null));
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
        caretPosition.node !== lastCaretPosition.node ||
        caretPosition.offset !== lastCaretPosition.offset
      ) {
        lastCaretPosition = caretPosition;
        handlers.forEach((handler) => void handler(caretPosition));
      }
    }
  };

  enhanced.addEventListener("keypress", onCaretMove);
  enhanced.addEventListener("keyup", onCaretMove);
  enhanced.addEventListener("keydown", onCaretMove);
  enhanced.addEventListener("mouseup", onCaretMove);
  enhanced.addEventListener("mousedown", onCaretMove);
  enhanced.addEventListener("mousemove", onCaretMove);
  enhanced.addEventListener("touchend", onCaretMove);
  enhanced.addEventListener("touchstart", onCaretMove);
  enhanced.addEventListener("touchmove", onCaretMove);
  enhanced.addEventListener("focus", onCaretMove);
  enhanced.addEventListener("blur", onCaretMove);
  enhanced.addEventListener("input", onCaretMove);
  enhanced.addEventListener("paste", onCaretMove);
  enhanced.addEventListener("cut", onCaretMove);
  enhanced.addEventListener("copy", onCaretMove);
  enhanced.addEventListener("select", onCaretMove);
  enhanced.addEventListener("selectstart", onCaretMove);
  enhanced.addEventListener("selectionchange", onCaretMove);
  enhanced.addEventListener("drag", onCaretMove);
  enhanced.addEventListener("dragend", onCaretMove);
  enhanced.addEventListener("dragenter", onCaretMove);
  enhanced.addEventListener("dragexit", onCaretMove);
  enhanced.addEventListener("dragleave", onCaretMove);
  enhanced.addEventListener("dragover", onCaretMove);
  enhanced.addEventListener("dragstart", onCaretMove);
  enhanced.addEventListener("drop", onCaretMove);
  enhanced.addEventListener("scroll", onCaretMove);
  enhanced.addEventListener("wheel", onCaretMove);
  enhanced.addEventListener("animationstart", onCaretMove);
  enhanced.addEventListener("animationend", onCaretMove);
  enhanced.addEventListener("animationiteration", onCaretMove);
  enhanced.addEventListener("transitionstart", onCaretMove);
  enhanced.addEventListener("transitionend", onCaretMove);
  enhanced.addEventListener("transitionrun", onCaretMove);
  enhanced.addEventListener("transitioncancel", onCaretMove);

  return enhanced;
};

type EnhanceElement<Element extends HTMLElement> = Element & GeneralExtensions;

type EventHandler<EventMap, EventName extends keyof EventMap> = (
  ...args: EventMap[EventName] extends void ? [] : [ev: EventMap[EventName]]
) => void | Promise<void>;

interface GeneralExtensions {
  on: <EventName extends keyof GeneralEventMap>(
    event: EventName,
    handler: EventHandler<GeneralEventMap, EventName>,
  ) => void;
  off: <EventName extends keyof GeneralEventMap>(
    event: EventName,
    handler: EventHandler<GeneralEventMap, EventName>,
  ) => void;
  once: <EventName extends keyof GeneralEventMap>(
    event: EventName,
    handler: EventHandler<GeneralEventMap, EventName>,
  ) => void;
}

interface GeneralEventMap {
  caretMove: { node: Node; offset: number } | null;
}

interface Trim extends H.Fn {
  return: this["arg0"] extends `${infer Prev} ,${infer Next}`
    ? H.$<Trim, `${Prev},${Next}`>
    : this["arg0"] extends `${infer Prev}, ${infer Next}`
    ? H.$<Trim, `${Prev},${Next}`>
    : this["arg0"] extends `${infer Prev}:is(${infer El})${infer Rest}`
    ? H.$<Trim, `${Prev}${El}${Rest}`>
    : this["arg0"] extends `${infer Prev}:where(${infer El})${infer Rest}`
    ? H.$<Trim, `${Prev}${El}${Rest}`>
    : this["arg0"] extends `${infer El}(${string})${infer Rest}`
    ? H.$<Trim, `${El}${Rest}`>
    : this["arg0"] extends `${infer El}[${string}]${infer Rest}`
    ? H.$<Trim, `${El}${Rest}`>
    : this["arg0"];
}

type ElementFromSelector<T> = H.Pipe<
  T,
  [
    Trim,
    H.Strings.Split<" ">,
    H.Tuples.Last,
    H.Strings.Split<",">,
    H.Tuples.ToUnion,
    H.Strings.Split<":" | "[" | "." | "#">,
    H.Tuples.At<0>,
    H.Match<
      [
        H.Match.With<keyof HTMLElementTagNameMap, H.Objects.Get<H._, HTMLElementTagNameMap>>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        H.Match.With<any, HTMLElement>,
      ]
    >,
  ]
>;
