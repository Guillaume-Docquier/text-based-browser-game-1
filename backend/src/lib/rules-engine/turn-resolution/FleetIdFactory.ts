import { branded } from "@guillaume-docquier/tools-ts"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { GameId } from "#lib/db/games/GameId.ts"

export type FleetIdFactory = () => FleetId

export const FleetIdFactory = {
  create: ({ gameId, turn }: { gameId?: GameId; turn?: number } = {}): FleetIdFactory => {
    let sequence = 0
    const prefix = gameId === undefined ? `fleet:unscoped:${turn ?? 0}` : `fleet:${gameId}:${turn ?? 0}`

    return () => branded<FleetId>(`${prefix}:${sequence++}`)
  },
}
