import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type {
  AbstractTargetConstraint,
  NoTargetConstraintParameters,
  NoTargetReferences,
} from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"

/**
 * Requires a planet target to be owned by the submitting player.
 */
export interface PlanetOwnedBySubmittingPlayerConstraint extends AbstractTargetConstraint {
  readonly type: "OWNED_BY_SUBMITTING_PLAYER"
  readonly references: NoTargetReferences
  readonly parameters: NoTargetConstraintParameters
}

/**
 * Creates the planet ownership constraint.
 */
export const PlanetOwnedBySubmittingPlayerConstraint = {
  type: "OWNED_BY_SUBMITTING_PLAYER",
  create: (): PlanetOwnedBySubmittingPlayerConstraint =>
    typedParse(PlanetOwnedBySubmittingPlayerConstraintSchema, {
      type: PlanetOwnedBySubmittingPlayerConstraint.type,
      references: {},
      parameters: {},
    }),
} as const

export const PlanetOwnedBySubmittingPlayerConstraintSchema = z.object({
  type: z.literal("OWNED_BY_SUBMITTING_PLAYER"),
  references: z.object({}).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<PlanetOwnedBySubmittingPlayerConstraint>
