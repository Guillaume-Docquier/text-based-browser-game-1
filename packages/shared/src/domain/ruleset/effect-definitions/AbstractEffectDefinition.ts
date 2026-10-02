import type { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import type { TargetRole } from "#shared/domain/ruleset/effect-definitions/TargetRole.ts"

export type AbstractEffectDefinition = Readonly<{
  /**
   * A discriminant for the effect definition type.
   * Every effect definition should specify a unique, constant value for type.
   */
  type: string
  /**
   * Maps target roles to definitions containing the Action Definition tag used to find each selected target.
   */
  targets: Readonly<Record<TargetRole, EffectDefinitionTargetDefinition>>

  /**
   * Unique effect definition parameters that actions can customize.
   */
  parameters: Readonly<Record<string, string | number>>
}>

/**
 * When an effect definition has no targets.
 */
export type NoTargets = Readonly<Record<TargetRole, never>>

/**
 * When an effect definition has no parameters.
 */
export type NoParameters = Readonly<Record<string, never>>
