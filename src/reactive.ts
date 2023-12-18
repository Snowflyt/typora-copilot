export interface WatchOptions {
  interval?: number;
}

export const watch = <T>(
  getter: () => T,
  callback: (newValue: T) => void | Promise<void>,
  options?: WatchOptions,
) => {
  const { interval: intervalMS = 1000 } = options ?? {};

  let currentValue = getter();
  const interval = setInterval(() => {
    const newValue = getter();
    if (newValue !== currentValue) {
      currentValue = newValue;
      void callback(newValue);
    }
  }, intervalMS);

  return () => clearInterval(interval);
};
