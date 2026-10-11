import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { SelectedStrengthSchema } from "#shared/domain/turns/actions/SelectedInputs.ts"

/** Colonization consumes the configured force only after Combat. */
export const ColonizeEffectDefinitionSchema = z.strictObject({
  type: z.literal("COLONIZE"),
  targets: z.strictObject({
    fleet: EffectDefinitionTargetDefinition.schemaFor(z.literal("FLEET")),
    planet: EffectDefinitionTargetDefinition.schemaFor(z.literal("PLANET")),
  }),
  parameters: z.strictObject({ requiredStrength: SelectedStrengthSchema }),
})
export type ColonizeEffectDefinition = z.infer<typeof ColonizeEffectDefinitionSchema>
export const ColonizeEffectDefinition = {
  type: "COLONIZE",
  create: ({
    fleetTag,
    planetTag,
    requiredStrength,
  }: {
    fleetTag: string
    planetTag: string
    requiredStrength: number
  }): ColonizeEffectDefinition =>
    typedParse(ColonizeEffectDefinitionSchema, {
      type: "COLONIZE",
      targets: { fleet: { actionTargetTag: fleetTag, targetType: "FLEET" }, planet: { actionTargetTag: planetTag, targetType: "PLANET" } },
      parameters: { requiredStrength },
    }),
} as const
