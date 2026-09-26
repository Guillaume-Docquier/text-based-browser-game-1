import { z } from "zod"
import { type TargetTag, TargetTagSchema } from "#lib/rules-engine/ruleset/actions/TargetTag.ts"
import { type TargetDefinition, TargetDefinitionSchema } from "#lib/rules-engine/ruleset/target-constraints/TargetDefinition.ts"

/**
 * Target slots for an Action Definition. Each record entry pairs a tag with its Target Definition.
 */
export type ActionDefinitionTargets = Record<TargetTag, TargetDefinition>

export const ActionDefinitionTargetsSchema = z
  .record(TargetTagSchema, TargetDefinitionSchema)
  .readonly() satisfies z.ZodType<ActionDefinitionTargets>
