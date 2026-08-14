import type { MechanicTargetType } from "#lib/rules-engine/mechanics/MechanicTargetType.ts"

export type MechanicTarget =
  | {
      /**
       * The key to use on the submitted action's targets to find the target id.
       * This is not the id of the actual target.
       */
      readonly tag: string
      /**
       * The type that this target must be.
       */
      readonly type: MechanicTargetType
    }
  | MechanicTargetSelf

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
