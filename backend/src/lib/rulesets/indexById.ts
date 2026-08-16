export function indexById<T extends { id: string }>(array: T[]): Record<string, T> {
  return array.reduce<Record<string, T>>((acc, val) => {
    acc[val.id] = val
    return acc
  }, {})
}
