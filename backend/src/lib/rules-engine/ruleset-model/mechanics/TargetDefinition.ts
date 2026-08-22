import z from "zod"
import { TargetTypeSchema, type TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

export type TargetDefinition =
  | {
      /**
       * The key to use on the submitted action's targets to find the target id.
       * This is not the id of the actual target.
       */
      readonly tag: string
      /**
       * The type that this target must be.
       */
      readonly type: TargetType
    }
  | TargetDefinitionSelf

/**
 * A special target that is always the player that submitted the action.
 * This value is always overridden by the server.
 */
export type TargetDefinitionSelf = typeof TargetDefinitionSelf
/**
 * A special target that is always the player that submitted the action.
 * This value is always overridden by the server.
 */
export const TargetDefinitionSelf = {
  tag: "self",
  type: "SELF",
} as const

export const TargetDefinitionSelfSchema = z.object({
  tag: z.literal(TargetDefinitionSelf.tag),
  type: z.literal(TargetDefinitionSelf.type),
}) satisfies z.ZodType<TargetDefinitionSelf>

export const TargetDefinitionSchema = z.union([
  z.object({
    tag: z.string(),
    type: TargetTypeSchema,
  }),
  TargetDefinitionSelfSchema,
]) satisfies z.ZodType<TargetDefinition>
