import { describe, expect, it } from "vitest"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { TrpcClient } from "../../tests/TrpcClient.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { playersTable } from "#lib/db/schema.ts"
import { createPlayerRowInsertStub } from "#lib/db/playerRowInsert.stub.ts"
import { Assert } from "@guillaume-docquier/tools-ts"
import type { PlayerRow } from "#lib/db/players.repository.ts"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

describe("games router", () => {
  it("creates a game for the authenticated player", async () => {
    const db = await createDbMock()
    const player = await createPlayer(db)

    const authService = new AuthServiceMock({ player })
    const api = await createApiStub({ db, authService })
    using trpcClient = new TrpcClient({ api })

    const createGameResult = await trpcClient.client.games.create.mutate({
      newGame: {
        name: "my new game",
        nbSeats: 43,
        tickIntervalSeconds: 420,
      },
    })

    expect(createGameResult).toEqual<typeof createGameResult>({
      newGame: {
        id: expect.any(Number),
        createdAt: expect.any(String),
        createdByPlayerId: player.id,
        name: "my new game",
        nbSeats: 43,
        tickIntervalSeconds: 420,
        endedAt: null,
        startedAt: null,
        winnerPlayerId: null,
      },
    })
  })

  it("rejects anonymous game creation", async () => {})

  it("gets summaries anonymously with all capability flags disabled", async () => {})

  it("gets summaries for an authenticated player who can join", async () => {})
})

async function createPlayer(db: NodePgDatabase): Promise<PlayerRow> {
  const player = (await db.insert(playersTable).values(createPlayerRowInsertStub()).returning())[0]
  Assert.isDefined(player)

  return player
}
