import { eq, sql } from "drizzle-orm"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { Planet } from "shared/domain/world/planets/Planet.ts"
import { type PlanetFacts, inCurrentVision, locateShips, scanSources } from "shared/domain/world/vision.ts"
import type { Transaction } from "./createDb.ts"
import { starsTable, planetsTable, buildingsTable, shipsTable, planetObservationsTable, playersTable } from "./schema.ts"

export function planetFacts({ ownerPlayerId, biome, size, area, metalProduction, remainingMetalDeposit }: Planet): PlanetFacts {
  return { ownerPlayerId, biome, size, area, metalProduction, remainingMetalDeposit }
}
export class PlanetObservationsRepository {
  private readonly tx: Transaction
  public constructor(tx: Transaction) {
    this.tx = tx
  }
  // oxlint-disable-next-line typescript/explicit-function-return-type -- Keep stored entity column types inferred from Drizzle.
  public async readWorld(gameId: GameId) {
    const tx = this.tx
    const stars = await tx.select().from(starsTable).where(eq(starsTable.gameId, gameId)).orderBy(starsTable.id)
    const planets = await tx.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)).orderBy(planetsTable.id)
    const buildings = await tx
      .select({ id: buildingsTable.id, type: buildingsTable.type, planetId: buildingsTable.planetId, site: buildingsTable.site })
      .from(buildingsTable)
      .where(eq(buildingsTable.gameId, gameId))
      .orderBy(buildingsTable.planetId, buildingsTable.site)
    const ships = await tx
      .select({
        id: shipsTable.id,
        type: shipsTable.type,
        ownerPlayerId: shipsTable.ownerPlayerId,
        planetId: shipsTable.planetId,
        starId: shipsTable.starId,
        trip: shipsTable.trip,
      })
      .from(shipsTable)
      .where(eq(shipsTable.gameId, gameId))
      .orderBy(shipsTable.id)
    return { stars, planets, buildingsByPlanet: Map.groupBy(buildings, (b) => b.planetId), ships: locateShips(ships, planets, stars) }
  }
  public async saveCurrentObservations(gameId: GameId, turn: number): Promise<void> {
    const tx = this.tx
    const { planets, buildingsByPlanet, ships } = await this.readWorld(gameId)
    const players = await tx.select({ id: playersTable.playerId }).from(playersTable).where(eq(playersTable.gameId, gameId))
    for (const player of players) {
      const sources = scanSources(player.id, planets, ships)
      const seen = planets
        .filter((planet) => inCurrentVision(planet, sources))
        .map((planet) => ({
          gameId,
          playerId: player.id,
          planetId: planet.id,
          observedTurn: turn,
          facts: planetFacts(planet),
          buildings: buildingsByPlanet.get(planet.id) ?? [],
        }))
      for (let offset = 0; offset < seen.length; offset += 1000) {
        await tx
          .insert(planetObservationsTable)
          .values(seen.slice(offset, offset + 1000))
          .onConflictDoUpdate({
            target: [planetObservationsTable.gameId, planetObservationsTable.playerId, planetObservationsTable.planetId],
            set: { observedTurn: sql`excluded.observed_turn`, facts: sql`excluded.facts`, buildings: sql`excluded.buildings` },
          })
      }
    }
  }
}
