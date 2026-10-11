import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"

/** Normal combat, staged by its composed Move until arrival. */
export const AssaultEffectDefinitionSchema = z.strictObject({
  type: z.literal("ASSAULT"),
  targets: z.strictObject({
    fleet: EffectDefinitionTargetDefinition.schemaFor(z.literal("FLEET")),
    planet: EffectDefinitionTargetDefinition.schemaFor(z.literal("PLANET")),
  }),
  parameters: z.strictObject({}),
})
export type AssaultEffectDefinition = z.infer<typeof AssaultEffectDefinitionSchema>
export const AssaultEffectDefinition = {
  type: "ASSAULT",
  create: ({ fleetTag, planetTag }: { fleetTag: string; planetTag: string }): AssaultEffectDefinition =>
    typedParse(AssaultEffectDefinitionSchema, {
      type: "ASSAULT",
      targets: { fleet: { actionTargetTag: fleetTag, targetType: "FLEET" }, planet: { actionTargetTag: planetTag, targetType: "PLANET" } },
      parameters: {},
    }),
} as const
