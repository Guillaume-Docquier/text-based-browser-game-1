import type { Unbranded } from "@guillaume-docquier/tools-ts"

/**
 * Removes brands throughout a type while retaining its required, optional, and readonly structure.
 */
export type DeepUnbranded<T> = DeepUnbrandedValue<Unbranded<T>>

type DeepUnbrandedValue<T> = T extends Date | RegExp | ((...args: never[]) => unknown)
  ? T
  : T extends Map<infer K, infer V>
    ? Map<DeepUnbranded<K>, DeepUnbranded<V>>
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepUnbranded<K>, DeepUnbranded<V>>
      : T extends Set<infer V>
        ? Set<DeepUnbranded<V>>
        : T extends ReadonlySet<infer V>
          ? ReadonlySet<DeepUnbranded<V>>
          : T extends readonly unknown[]
            ? { [K in keyof T]: DeepUnbranded<T[K]> }
            : T extends object
              ? { [K in keyof T as Unbranded<K> & PropertyKey]: DeepUnbranded<T[K]> }
              : T
