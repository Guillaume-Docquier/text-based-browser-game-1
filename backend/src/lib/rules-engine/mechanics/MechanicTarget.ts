import type { MechanicTargetType } from "#lib/rules-engine/mechanics/MechanicTargetType.ts"

export type MechanicTarget =
  | {
      /**
       * The action's target tag to reference
       */
      readonly tag: string
      /**
       * The type that this target must be
       */
      readonly type: MechanicTargetType
    }
  | MechanicTargetSelf

export type MechanicTargetSelf = typeof MechanicTargetSelf
export const MechanicTargetSelf = {
  tag: "self",
  type: "SELF",
} as const
