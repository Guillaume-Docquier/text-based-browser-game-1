import { z } from "zod"
import { QuantityOfResourceSchema } from "#shared/domain/resources/QuantityOfResource.ts"
import { ActionDefinitionIdSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionTierSchema } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionTypeSchema } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { ConstraintSchema } from "../constraints/Constraint.ts"

/**
 * Raw invocations defer parameter parsing to their engine-owned mechanic.
 */
export const InvocationSchema = z.strictObject({
  use: z.string(),
  bind: z.record(z.string(), z.string()),
  parameters: z.unknown(),
})
export type InvocationDefinition = z.output<typeof InvocationSchema>
export const ActionDefinitionSchema = z.strictObject({
  id: ActionDefinitionIdSchema,
  name: z.string(),
  type: ActionTypeSchema,
  tier: ActionTierSchema,
  targets: z.record(z.string(), z.enum(["fleet", "planet", "player"])),
  constraints: z.array(ConstraintSchema),
  costs: z.array(QuantityOfResourceSchema),
  mechanics: z.array(InvocationSchema),
})
export type ActionDefinition = Omit<z.input<typeof ActionDefinitionSchema>, "constraints" | "costs" | "mechanics"> & {
  readonly constraints: ReadonlyArray<z.input<typeof ConstraintSchema>>
  readonly costs: ReadonlyArray<z.input<typeof QuantityOfResourceSchema>>
  readonly mechanics: readonly InvocationDefinition[]
}
export type ParsedActionDefinition = z.output<typeof ActionDefinitionSchema>
