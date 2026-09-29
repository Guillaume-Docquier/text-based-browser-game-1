import { branded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { and, eq } from "drizzle-orm"
import type { FleetId } from "game-rules/models/FleetId.ts"
import { FleetNameSchema } from "game-rules/models/FleetName.ts"
import type { GameId } from "game-rules/models/GameId.ts"
import type { PlanetId } from "game-rules/models/PlanetId.ts"
import type { PlayerId } from "game-rules/models/PlayerId.ts"
import { v4 } from "uuid"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { fleetsTable, planetsTable } from "#lib/db/schema.ts"

/**
 * Sets up controlled fleet movement scenarios in integration tests.
 */
export class FleetMovementTestRepository extends PostgresRepository {
  public async positionPlanet({ gameId, planetId, x, y }: { gameId: GameId; planetId: PlanetId; x: number; y: number }): Promise<void> {
    await this.db
      .update(planetsTable)
      .set({ x, y })
      .where(and(eq(planetsTable.gameId, gameId), eq(planetsTable.id, planetId)))
  }

  public async createFleet({
    gameId,
    ownerPlayerId,
    originPlanetId,
    name,
    strength,
  }: {
    gameId: GameId
    ownerPlayerId: PlayerId
    originPlanetId: PlanetId
    name: string
    strength: number
  }): Promise<FleetId> {
    const id = branded<FleetId>(v4())
    await this.db.insert(fleetsTable).values({
      id,
      gameId,
      ownerPlayerId,
      originPlanetId,
      name: typedParse(FleetNameSchema, name),
      strength,
    })
    return id
  }
}
