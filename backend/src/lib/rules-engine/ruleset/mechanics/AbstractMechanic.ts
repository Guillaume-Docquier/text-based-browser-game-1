import type { Branded } from "@guillaume-docquier/tools-ts"
import type { MechanicTargetDefinition } from "#lib/rules-engine/ruleset/mechanics/MechanicTargetDefinition.ts"

/**
 * The role of the target for this mechanic, such as "player", "defendingFleet" or "planet".
 *
 * The role is how the mechanic talks about a target within the mechanic.
 * A {@link MechanicTargetDefinition.actionTargetTag} is a reference to the target id slot on the action, which might have another name / meaning in the context of the action.
 *
 * For example, an action might say "fleet 1 gains 1 strength and fleet 2 gains 2 strength"
 *
 * The action will have 2 target slots: "fleet 1" and "fleet 2"
 * The GainStrength mechanic will have 1 target role: "fleet"
 * The action will have 2 mechanics:
 * - GainStrength with actionTargetTag "fleet 1" for target role "fleet" and strength 1
 * - GainStrength with actionTargetTag "fleet 2" for target role "fleet" and strength 2
 *
 * In other words, the role declares what the mechanic needs, the tag declares where on the action that target id will be.
 */
export type TargetRole = Branded<"TargetRole", string>

export type AbstractMechanic = Readonly<{
  type: string
  /**
   * Maps target roles to their actual target.
   */
  targets: Readonly<Record<TargetRole, MechanicTargetDefinition>>

  /**
   * Unique mechanic parameters that actions can customize.
   */
  parameters: Readonly<Record<string, string | number>>
}>

/**
 * When a mechanic has no targets.
 */
export type NoTargets = Readonly<Record<TargetRole, never>>

/**
 * When a mechanic has no parameters.
 */
export type NoParameters = Readonly<Record<string, never>>
