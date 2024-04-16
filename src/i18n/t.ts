import { P, match } from "ts-pattern";

import en from "./en.json";
import zhCN from "./zh-CN.json";

/**
 * Path of an object joined by dots.
 *
 * @example
 * ```typescript
 * type R = PathOf<{ a: { b: { c: string }, d: string } }>;
 * //   ^?: "a.b.c" | "a.d"
 * ```
 */
export type PathOf<O> = keyof {
  [P in keyof O & (string | number) as O[P] extends string ? P : `${P}.${PathOf<O[P]>}`]: void;
};

interface LocaleMap {
  [key: string]: string | LocaleMap;
}

/**
 * Get locale string by path.
 * @param path The path of the locale string.
 * @returns The locale string.
 *
 * @example
 * ```typescript
 * // en.json
 * {"a": {"b": {"c": "foo"}}}
 *
 * // Example
 * t("a.b.c"); // => "foo"
 * t("d"); // => "d". Warning: Cannot find translation for "d": "d" not found.
 * t("d.c"); // => "d.c". Warning: Cannot find translation for "d.c": "d" not found.
 * t("a.d.c"); // => "a.d.c". Warning: Cannot find translation for "a.d.c": "d" not found in "a".
 * t("a.b.c.d"); // => "a.b.c.d". Warning: Cannot find translation for "a.b.c.d": "a.b.c" is not an object.
 * t(""); // => "". Warning: Empty path is not allowed.
 * t("a.b.d"); // => "a.b.d". Warning: Cannot find translation for "a.b.d": "d" not found in "a.b".
 * t("a.b"); // => "a.b". Warning: Cannot find translation for "a.b": "a.b" is not a string.
 * ```
 */
export const t = (path: PathOf<typeof en>): string => {
  const locale =
    window._options.appLocale ||
    (navigator.languages && navigator.languages[0]) ||
    navigator.language ||
    ("userLanguage" in navigator &&
      typeof navigator.userLanguage === "string" &&
      navigator.userLanguage) ||
    "en";
  const keys = path.split(".").filter(Boolean);
  const localeMap: LocaleMap = match(locale)
    .with(P.union("en", P.string.startsWith("en-")), () => en)
    .with(P.union("zh-CN", "zh-Hans"), () => zhCN)
    .otherwise(() => en);
  let tmp = localeMap;
  try {
    const visitedKeys: string[] = [];
    for (const key of keys.slice(0, -1)) {
      const x = tmp[key];
      if (x === undefined)
        throw (
          `Cannot find translation for "${path}": "${key}" not found` +
          (visitedKeys.length > 0 ? ` in "${visitedKeys.join(".")}".` : ".")
        );
      if (typeof x === "string")
        throw `Cannot find translation for "${path}": "${[...visitedKeys, key].join(".")}" is not an object.`;
      tmp = x;
      visitedKeys.push(key);
    }
    const lastKey = keys.at(-1);
    if (lastKey === undefined) throw "Empty path is not allowed.";
    const res = tmp[lastKey];
    if (res === undefined)
      throw (
        `Cannot find translation for "${path}": "${lastKey}" not found` +
        (visitedKeys.length > 0 ? ` in "${visitedKeys.join(".")}".` : ".")
      );
    if (typeof res !== "string")
      throw `Cannot find translation for "${path}": "${path}" is not a string.`;
    return res;
  } catch (e) {
    console.warn(e);
    return path;
  }
};

/**
 * Get the all possible paths of an object.
 * @param o The object.
 * @returns
 *
 * @example
 * ```typescript
 * pathOf({ a: { b: { c: "foo" }, d: "bar" } }); // => ["a.b.c", "a.d"]
 * ```
 */
export const pathOf = <O extends LocaleMap>(o: O): PathOf<O>[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "string" ? [k] : pathOf(v as never).map((x) => `${k}.${x}`),
  ) as unknown as PathOf<O>[];
