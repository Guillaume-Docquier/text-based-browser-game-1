import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect, it } from "vitest"
import { buildingsTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#testing/ConcurrencyTestApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"

describe("building placement constraints", () => {
  it("should meet DB-0001 When buildings are stored on a planet, each hex holds at most one building and the planet holds at most one command center.", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    await using server = await ConcurrencyTestApiServer.create(postgres)
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const view = await player.client.gameplay.getPlayerView.query({ gameId })
    const planet = view.galaxy.systems.flatMap(({ planets }) => planets).find((candidate) => candidate.coordinates === "63:50:40")
    Assert.isDefined(planet)
    const pool = postgres.db.$client
    await pool.query("ALTER TYPE building_type ADD VALUE 'TEST_BUILDING'")
    const writer = await pool.connect()
    const insert = 'insert into "buildings" (game_id, planet_id, type, site) values ($1, $2, $3, $4)'

    using _connection = {
      [Symbol.dispose](): void {
        writer.release(true)
      },
    }
    const {
      rows: [session],
    } = await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    Assert.isDefined(session)
    for (const race of [
      { firstType: "TEST_BUILDING", firstSite: 1, secondSite: 1, constraint: "buildings_one_per_site" },
      { firstType: "COMMAND_CENTER", firstSite: 0, secondSite: 2, constraint: "buildings_one_command_center_per_planet" },
    ]) {
      // Act
      await writer.query("BEGIN")
      await writer.query(insert, [gameId, planet.id, race.firstType, race.firstSite])
      const competingInsert = Result.tryCatch(pool.query(insert, [gameId, planet.id, "COMMAND_CENTER", race.secondSite]))
      await postgres.concurrency.waitForBlockedQuery({ blockedBy: session.pid, command: "insert", table: buildingsTable, lock: "row" })
      await writer.query("COMMIT")

      // Assert
      expect(await competingInsert).toMatchObject({ error: { code: "23505", constraint: race.constraint } })
    }
  })
})
