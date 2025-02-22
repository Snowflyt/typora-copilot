/**
 * Cache the result of a function.
 * @param fn The function to cache.
 * @returns
 */
export const cache = <F extends (...args: any) => unknown>(fn: F): F => {
  const cache = new Map();
  const result = ((...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as F;
  Object.defineProperty(result, "name", {
    value: fn.name,
    writable: false,
    enumerable: false,
    configurable: true,
  });
  return result;
};
