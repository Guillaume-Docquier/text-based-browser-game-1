/**
 * Turns a fake enum (const {} as const) into a pgEnum compatible parameter.
 * This is just type gymnastics
 */
export function pgEnumify<TEnumLike extends string>(enumLike: Record<string, TEnumLike>): [TEnumLike, ...TEnumLike[]] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This is trusted code
  return Object.values(enumLike) as [TEnumLike, ...TEnumLike[]]
}
