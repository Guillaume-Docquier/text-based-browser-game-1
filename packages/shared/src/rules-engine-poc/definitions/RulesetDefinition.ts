import { z } from "zod"
import { ResourcesSchema } from "#shared/domain/resources/Resources.ts"
import { PooledActionSchema } from "#shared/domain/ruleset/PooledAction.ts"
import { RulesetIdSchema } from "#shared/domain/ruleset/RulesetId.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "./ActionDefinition.ts"

/**
 * JSON authoring format, separate from the current persisted Ruleset.
 */
export const RulesetDefinitionSchema = z.strictObject({
  id: RulesetIdSchema,
  name: z.string(),
  isDefault: z.boolean(),
  actionDefinitions: z.array(ActionDefinitionSchema),
  actionPool: z.array(PooledActionSchema),
  startingResources: ResourcesSchema,
})
export type RulesetDefinition = z.output<typeof RulesetDefinitionSchema>
export type RulesetInput = Omit<z.input<typeof RulesetDefinitionSchema>, "actionDefinitions" | "actionPool"> & {
  readonly actionDefinitions: readonly ActionDefinition[]
  readonly actionPool: ReadonlyArray<z.input<typeof PooledActionSchema>>
}
