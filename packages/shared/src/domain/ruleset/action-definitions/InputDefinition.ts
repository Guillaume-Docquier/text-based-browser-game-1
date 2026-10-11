import { z } from "zod"
import { TargetTagSchema } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
export const InputDefinitionSchema = z.object({ type: z.literal("FLEET_STRENGTH"), fleetTargetTag: TargetTagSchema })
export type InputDefinition = z.infer<typeof InputDefinitionSchema>
