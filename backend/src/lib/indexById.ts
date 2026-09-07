export function indexById<TId extends string | number, TElement extends { id: TId }>(array: TElement[]): Record<TId, TElement> {
  // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion -- Strange TS quirk?
  const indexed = {} as Record<TId, TElement>
  for (const val of array) {
    indexed[val.id] = val
  }
  return indexed
}
