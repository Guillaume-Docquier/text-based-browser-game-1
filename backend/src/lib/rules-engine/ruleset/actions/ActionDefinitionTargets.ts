import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { type TargetTag, TargetTagSchema } from "#lib/rules-engine/ruleset/actions/TargetTag.ts"
import { type TargetDefinition, TargetDefinitionSchema } from "#lib/rules-engine/ruleset/target-constraints/TargetDefinition.ts"

export type ActionDefinitionTargets = Record<TargetTag, TargetDefinition>

export const ActionDefinitionTargets = {
  /**
   * Just a type trick to avoid the weird key branding syntax when building action definition targets
   */
  create: (actionDefinitionTargets: DeepUnbranded<ActionDefinitionTargets>): ActionDefinitionTargets => {
    return actionDefinitionTargets
  },
}

export const ActionDefinitionTargetsSchema = z
  .record(TargetTagSchema, TargetDefinitionSchema)
  .readonly() satisfies z.ZodType<ActionDefinitionTargets>
