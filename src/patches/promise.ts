declare global {
  interface PromiseConstructor {
    /**
     * Get the first resolved promise in order.
     *
     * Suppose we have `[<pending>, <pending>, <pending>]`, when it turns to
     * `[<resolved>, <pending>, <pending>]`, we can directly return the resolved value since it's
     * the first one. However, when it turns to `[<pending>, <resolved>, <pending>]`, we have to
     * wait for the first one to settle, if it finally turns to
     * `[<rejected>, <resolved>, <pending>]`, we can directly return the resolved value (the 2nd),
     * or if it turns to `[<resolved>, <resolved>, <pending>]`, we should return the first one.
     * @param values An array or iterable of Promises.
     * @returns A new Promise.
     */
    orderedFirstResolved<T extends readonly unknown[] | []>(values: T): Promise<Awaited<T[number]>>;
    /**
     * Get the first resolved promise in order.
     *
     * Suppose we have `[<pending>, <pending>, <pending>]`, when it turns to
     * `[<resolved>, <pending>, <pending>]`, we can directly return the resolved value since it's
     * the first one. However, when it turns to `[<pending>, <resolved>, <pending>]`, we have to
     * wait for the first one to settle, if it finally turns to
     * `[<rejected>, <resolved>, <pending>]`, we can directly return the resolved value (the 2nd),
     * or if it turns to `[<resolved>, <resolved>, <pending>]`, we should return the first one.
     * @param values An array or iterable of Promises.
     * @returns A new Promise.
     */
    orderedFirstResolved<T>(values: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>>;
  }
}

Promise.orderedFirstResolved = function orderedFirstResolved<T>(
  values: Iterable<T | PromiseLike<T>>,
): Promise<T> {
  const states: ("pending" | "resolved" | "rejected")[] = [];
  const resolvedValues: T[] = [];
  const errors: unknown[] = [];
  let rejectedPointer = 0;

  return new Promise((resolve, reject) => {
    const tryResolve = () => {
      while (states[rejectedPointer] === "rejected")
        if (++rejectedPointer === states.length) {
          const message = "All promises were rejected";
          reject(
            "AggregateError" in window ?
              (new (window.AggregateError as any)(errors, message) as Error)
            : new Error(message),
          );
          return;
        }
      if (states[rejectedPointer] === "resolved") resolve(resolvedValues[rejectedPointer]!);
    };

    let i = 0;
    for (const value of values) {
      const index = i++;
      states.push("pending");

      Promise.resolve(value).then(
        (resolvedValue) => {
          states[index] = "resolved";
          resolvedValues[index] = resolvedValue;
          tryResolve();
        },
        () => {
          states[index] = "rejected";
          errors[index] = new Error("Promise rejected");
          tryResolve();
        },
      );
    }

    if (i === 0) {
      const message = "All promises were rejected";
      reject(
        "AggregateError" in window ?
          (new (window.AggregateError as any)([], message) as Error)
        : new Error(message),
      );
    }
  });
};

declare global {
  interface PromiseConstructor {
    /**
     * Defer an operation to the next tick. Using `process.nextTick` if available, otherwise
     * `Promise.resolve().then`.
     * @param factory A callback used to initialize the promise.
     * @returns A new Promise.
     */
    defer<T>(factory: () => T): Promise<Awaited<T>>;
    /**
     * Defer an operation to the next tick. Using `process.nextTick` if available, otherwise
     * `Promise.resolve().then`.
     * @param factory A callback used to initialize the promise.
     * @returns A new Promise.
     */
    defer<T>(factory: () => T | PromiseLike<T>): Promise<Awaited<T>>;
  }
}

Promise.defer = function defer<T>(factory: () => T | PromiseLike<T>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (globalThis.process && typeof process.nextTick === "function") {
    const isThenable = (value: unknown): value is PromiseLike<T> =>
      value !== null &&
      (typeof value === "object" || typeof value === "function") &&
      typeof (value as PromiseLike<T>).then === "function";

    return new Promise((resolve, reject) =>
      process.nextTick(() => {
        const result = factory();
        if (isThenable(result)) result.then(resolve, reject);
        else resolve(result);
      }),
    );
  }

  return Promise.resolve().then(factory);
};

export {};
