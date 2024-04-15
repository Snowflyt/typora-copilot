/**
 * Construct a type with a set of readonly properties `K` of type `T`.
 */
export type ReadonlyRecord<K extends PropertyKey, T> = { readonly [P in K]: T };

/**
 * Check if two types are equal.
 */
export type Equals<T, U> =
  (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? true : false;

/**
 * Tell TS to evaluate an object type immediately. Actually does nothing, but
 * it's useful for debugging or make type information more readable.
 *
 * Sometimes strange things happen when you try to use it with a _generic type_,
 * so avoid that if possible.
 */
export type _Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

export type _IdDeep<T> =
  T extends infer U ?
    U extends object ?
      { [K in keyof U]: _IdDeep<U[K]> }
    : U
  : never;

/**
 * Merge two object types, preferring the second type when keys overlap.
 *
 * @example
 * ```typescript
 * type A = { a: number; b: number; c?: number; d?: number; e?: number; }
 * type B = { b: string; c: string; d?: string; f: string; g?: string; }
 * type R = Merge<A, B>;
 * //   ^ { a: number; b: string; c: string; d?: string; e?: number; f: string; g?: string; }
 * ```
 */
export type Merge<L, R> = _Id<
  Pick<L, Exclude<keyof L, keyof R>> &
    Pick<R, Exclude<keyof R, _OptionalPropertyNames<R>>> &
    Pick<R, Exclude<_OptionalPropertyNames<R>, keyof L>> &
    _SpreadProperties<L, R, _OptionalPropertyNames<R> & keyof L>
>;
type _OptionalPropertyNames<T> = {
  [K in keyof T]-?: NonNullable<unknown> extends { [P in K]: T[K] } ? K : never;
}[keyof T];
type _SpreadProperties<L, R, K extends keyof L & keyof R> = {
  [P in K]: L[P] | Exclude<R[P], undefined>;
};
