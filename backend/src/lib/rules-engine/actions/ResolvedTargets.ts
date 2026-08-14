/**
 * The action definition targets are always an empty string.
 * The resolved targets point to actual target ids.
 */
export type ResolvedTargets = {
  readonly self: string
  readonly [targetTag: string]: string
}
