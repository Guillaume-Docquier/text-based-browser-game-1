import type { MechanicTargetDefinition } from "#lib/rules-engine/ruleset/mechanics/MechanicTargetDefinition.ts"
import type { TargetRole } from "#lib/rules-engine/ruleset/mechanics/TargetRole.ts"

export type AbstractMechanic = Readonly<{
  /**
   * A discriminant for the mechanic type.
   * Every mechanic should specify a unique, constant, value for type.
   */
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
