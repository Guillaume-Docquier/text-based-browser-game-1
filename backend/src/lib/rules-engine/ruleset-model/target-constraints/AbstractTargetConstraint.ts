/**
 * Common shape for a declarative target constraint.
 */
export type AbstractTargetConstraint<TType extends string, TReferences, TParameters> = Readonly<{
  type: TType
  references: TReferences
  parameters: TParameters
}>

/**
 * References used by a constraint that does not depend on another target.
 */
export type NoTargetReferences = Readonly<Record<string, never>>

/**
 * Parameters used by a constraint that has no configurable values.
 */
export type NoTargetConstraintParameters = Readonly<Record<string, never>>
