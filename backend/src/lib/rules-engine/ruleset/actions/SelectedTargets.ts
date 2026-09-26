import { z } from "zod"

/**
 * Maps Action Definition target tags to the selected target ids.
 */
export type SelectedTargets = Readonly<Record<string, string>>

export const SelectedTargetsSchema = z.record(z.string(), z.string()).readonly() satisfies z.ZodType<SelectedTargets>
