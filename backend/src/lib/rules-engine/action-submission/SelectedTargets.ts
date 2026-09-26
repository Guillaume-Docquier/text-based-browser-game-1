import { z } from "zod"
import { TargetTagSchema, type TargetTag } from "#lib/rules-engine/ruleset/actions/TargetTag.ts"
import { TargetIdSchema, type TargetId } from "#lib/rules-engine/ruleset/target-constraints/TargetId.ts"

/**
 * Maps Action Definition target slot tags to the selected target ids.
 */
export type SelectedTargets = Readonly<Record<TargetTag, TargetId>>

export const SelectedTargetsSchema = z.record(TargetTagSchema, TargetIdSchema).readonly() satisfies z.ZodType<SelectedTargets>
