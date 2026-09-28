import type { StarId } from "game-rules/models/StarId.ts"
import type { StarCoordinates } from "#api/gameplay/galaxy-creation/StarCoordinates.ts"

export type Star = {
  readonly id: StarId
  readonly name: string
  readonly coordinates: StarCoordinates
  readonly x: number
  readonly y: number
}
