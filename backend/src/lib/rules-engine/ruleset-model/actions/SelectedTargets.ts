import { z } from "zod"

/**
 * The action definition targets are always an empty string.
 * The selected targets point to actual target ids.
 */
export type SelectedTargets = Readonly<Record<string, string>>

export const SelectedTargetsSchema = z.record(z.string(), z.string()).readonly() satisfies z.ZodType<SelectedTargets>
