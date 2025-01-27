import { mapValues } from "radash";
import { kebabCase } from "string-ts";

export type Settings = typeof defaultSettings;
const defaultSettings = {
  /* General */
  disableCompletions: false,
  useInlineCompletionTextInSource: true,
  useInlineCompletionTextInPreviewCodeBlocks: false,

  /* Node.js runtime */
  nodePath: null as string | null,
};

export const settings = (() => {
  const changeListeners = new Map<keyof Settings, Array<() => void>>();
  const onChange = <K extends keyof Settings>(key: K, callback: (value: Settings[K]) => void) => {
    const listener = () => callback(settings[key]);
    if (!changeListeners.has(key)) changeListeners.set(key, []);
    changeListeners.get(key)?.push(listener);
    return () => {
      const listeners = changeListeners.get(key);
      if (!listeners) return;
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  };

  const clear = (key: keyof Settings) => {
    if (localStorage.getItem(kebabCase(key)) === null) return;
    const changed = JSON.stringify(settings[key]) !== JSON.stringify(defaultSettings[key]);
    localStorage.removeItem(kebabCase(key));
    if (changed) changeListeners.get(key)?.forEach((listener) => listener());
  };

  const localStorageKeys = mapValues(defaultSettings, (_, key) => kebabCase(key));
  return new Proxy(
    {} as Settings & { readonly onChange: typeof onChange; readonly clear: typeof clear },
    {
      get(_target, prop, _receiver) {
        if (prop === "onChange") return onChange;
        if (prop === "clear") return clear;
        if (!(prop in defaultSettings)) throw new Error(`Unknown setting: ${String(prop)}`);
        const unparsedValue = localStorage.getItem(localStorageKeys[prop as keyof Settings]);
        if (unparsedValue === null) return defaultSettings[prop as keyof Settings];
        return JSON.parse(unparsedValue);
      },
      set(_target, prop, value, _receiver) {
        if (prop === "onChange") return false;
        if (prop === "clear") return false;
        if (!(prop in defaultSettings)) return false;
        const jsonifiedValue = JSON.stringify(value);
        if (
          jsonifiedValue ===
          (localStorage.getItem(localStorageKeys[prop as keyof Settings]) ??
            JSON.stringify(defaultSettings[prop as keyof Settings]))
        )
          // No change
          return true;
        localStorage.setItem(localStorageKeys[prop as keyof Settings], jsonifiedValue);
        changeListeners.get(prop as keyof Settings)?.forEach((listener) => listener());
        return true;
      },
    },
  );
})();
