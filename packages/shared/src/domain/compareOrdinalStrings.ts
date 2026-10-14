/**
 * Compares stable identifiers by code-unit order, independent of the user's locale.
 */
export function compareOrdinalStrings(first: string, second: string): number {
  if (first < second) {
    return -1
  }
  if (first > second) {
    return 1
  }
  return 0
}
