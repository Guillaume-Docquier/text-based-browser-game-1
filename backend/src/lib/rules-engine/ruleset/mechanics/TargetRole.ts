import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * The role of the target for this mechanic, such as "player", "defendingFleet" or "planet".
 *
 * The role is how the mechanic talks about a target within the mechanic.
 * A {@link MechanicTargetDefinition.actionTargetTag} refers to the tag of an Action Definition target slot.
 * The Action Submission stores the selected target id under that tag.
 *
 * For example, an action might say "fleet 1 gains 1 strength and fleet 2 gains 2 strength"
 *
 * The Action Definition will have 2 target slots, tagged "fleet 1" and "fleet 2".
 * The GainStrength mechanic will have 1 target role: "fleet"
 * The action will have 2 mechanics:
 * - GainStrength with actionTargetTag "fleet 1" for target role "fleet" and strength 1
 * - GainStrength with actionTargetTag "fleet 2" for target role "fleet" and strength 2
 *
 * In other words, the role declares what the mechanic needs, the tag declares where on the action that target id will be.
 */
export type TargetRole = Branded<"TargetRole", string>
export const TargetRoleSchema = z.string().transform(branded<TargetRole>) satisfies z.ZodType<TargetRole>
