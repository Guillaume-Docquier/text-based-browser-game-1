/**
 * Common shape for a declarative target constraint.
 */
export type AbstractTargetConstraint = Readonly<{
  /**
   * The discriminator for the constraint.
   */
  type: string
  /**
   * References to other targets.
   */
  references: Readonly<Record<string, string>>
  /**
   * Parameters to customize a target constraint.
   */
  parameters: Readonly<Record<string, string>>
}>

/**
 * When a target constraint does not depend on another target.
 */
export type NoTargetReferences = Readonly<Record<string, never>>

/**
 * When a target constraint has no configurable values.
 */
export type NoTargetConstraintParameters = Readonly<Record<string, never>>
