import type { StarCoordinates } from "#api/shared/StarCoordinates.ts"
import type { StarId } from "#lib/db/stars/StarId.ts"

export type StarModel = {
  readonly id: StarId
  readonly name: string
  readonly coordinates: StarCoordinates
  readonly x: number
  readonly y: number
}
