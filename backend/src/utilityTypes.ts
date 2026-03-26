type ReplaceNullWithUndefined<T> = T extends null ? undefined : T

/**
 * Replaces top level null keys with undefined
 *
 * @example
 * ```ts
 * type NowUndef = NullToUndefined<{
 *   shallow: string | null,
 *   deep: {
 *     property: string | null
 *   }
 * }>
 * // ^?
 * // {
 * //   shallow: string | undefined,
 * //   deep: {
 * //     property: string | null
 * //   }
 * // }
 * ```
 */
export type NullToUndefined<T> = {
  [P in keyof T]: ReplaceNullWithUndefined<T[P]>
}
