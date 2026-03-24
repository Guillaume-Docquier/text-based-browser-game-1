type ReplaceNullWithUndefined<T> = T extends null ? undefined : T
export type NullToUndefined<T> = {
  [P in keyof T]: ReplaceNullWithUndefined<T[P]>
}
