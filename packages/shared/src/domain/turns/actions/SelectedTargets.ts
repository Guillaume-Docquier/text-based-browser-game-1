import { z } from "zod"
import { TargetTagSchema, type TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { TargetIdSchema, type TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"

/**
 * Maps Action Definition target slot tags to the selected target ids.
 */
export type SelectedTargets = Readonly<Record<TargetTag, TargetId>>

export const SelectedTargetsSchema = z.record(TargetTagSchema, TargetIdSchema).readonly() satisfies z.ZodType<SelectedTargets>
