import type { MechanicTargetType } from "#lib/rules-engine/mechanics/MechanicTargetType.ts"

export type MechanicTargetOfType<TType extends MechanicTargetType> = {
  /**
   * The key to use on the submitted action's targets to find the target id.
   * This is not the id of the actual target.
   */
  readonly tag: string
  /**
   * The type that this target must be.
   */
  readonly type: TType
}

export type MechanicTarget = MechanicTargetOfType<MechanicTargetType> | MechanicTargetSelf

export type PlayerMechanicTarget = MechanicTargetOfType<typeof MechanicTargetType.PLAYER> | MechanicTargetSelf

/**
 * A special target that is always the player that submitted the action.
 * This value is always overridden by the server.
 */
export type MechanicTargetSelf = typeof MechanicTargetSelf
/**
 * A special target that is always the player that submitted the action.
 * This value is always overridden by the server.
 */
export const MechanicTargetSelf = {
  tag: "self",
  type: "SELF",
} as const
