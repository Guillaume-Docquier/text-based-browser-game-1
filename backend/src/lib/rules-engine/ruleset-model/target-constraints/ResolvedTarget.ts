import type { ReadonlyDeep } from "type-fest"
import type { Fleet, Planet, Player } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * A target resolved from a target reference and the current turn state.
 *
 * The wrapper preserves the entity discriminator after resolution so constraint
 * evaluators can handle each supported entity without guessing from fields.
 */
export type ResolvedTarget =
  | Readonly<{
      type: "FLEET"
      entity: ReadonlyDeep<Fleet>
    }>
  | Readonly<{
      type: "PLANET"
      entity: ReadonlyDeep<Planet>
    }>
  | Readonly<{
      type: "PLAYER"
      entity: ReadonlyDeep<Player>
    }>
