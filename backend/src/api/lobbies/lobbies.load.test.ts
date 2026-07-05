import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"
import type { AccountModel } from "#api/accounts/accounts.repository.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { playersTable, resourcesTable } from "#lib/db/schema.ts"
import {
  createAccounts,
  createLoadTestServer,
  ignoreExpectedRequestFailures,
  randomDelay,
  type LoadTestServer,
} from "#tests/loadTestHarness.ts"

const NB_LOAD_TEST_ACCOUNTS = 20

let server: LoadTestServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

describe("lobby concurrency load tests", () => {
  it("should enforce the seat count when multiple accounts join the same game concurrently", async () => {
    const loadTestServer = await createLoadTestServer()
    server = loadTestServer
    const accounts = await createAccounts({ accountsRepository: loadTestServer.accountsRepository, nbAccounts: NB_LOAD_TEST_ACCOUNTS })
    const creator = accounts[0]
    Assert.isDefined(creator)

    const creatorClient = loadTestServer.createClient(creator)
    const { createdGameId } = await creatorClient.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ nbSeats: 4 }),
    })

    await ignoreExpectedRequestFailures(
      accounts.slice(1).map(async (account) => {
        await randomDelay()
        await loadTestServer.createClient(account).lobbies.join.mutate({ gameId: createdGameId })
      }),
    )

    const lobby = await creatorClient.lobbies.getById.query({ gameId: createdGameId })
    expect(lobby.players).toHaveLength(4)
  })

  it("should keep started-game resources consistent while accounts join and leave concurrently", async () => {
    const loadTestServer = await createLoadTestServer()
    server = loadTestServer
    const accounts = await createAccounts({ accountsRepository: loadTestServer.accountsRepository, nbAccounts: NB_LOAD_TEST_ACCOUNTS })
    const creator = accounts[0]
    Assert.isDefined(creator)

    const creatorClient = loadTestServer.createClient(creator)
    const { createdGameId } = await creatorClient.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ nbSeats: NB_LOAD_TEST_ACCOUNTS }),
    })

    await Promise.all([
      creatorClient.gameplay.startGame.mutate({ gameId: createdGameId }),
      ...accounts.slice(1).map(async (account) => {
        await joinThenLeave({ loadTestServer, account, gameId: createdGameId })
      }),
    ])

    const lobby = await creatorClient.lobbies.getById.query({ gameId: createdGameId })
    const playerIds = lobby.players.map((player) => player.id).sort()
    const playerRows = await loadTestServer.db.select().from(playersTable).where(eq(playersTable.gameId, createdGameId))
    const resourceRows = await loadTestServer.db.select().from(resourcesTable).where(eq(resourcesTable.gameId, createdGameId))

    const resourcePlayerIds = [...new Set(resourceRows.map((resource) => resource.playerId))].sort()
    expect(resourcePlayerIds).toEqual(playerIds)
    expect(playerRows.map((player) => player.playerId).sort()).toEqual(playerIds)

    for (const resource of resourceRows) {
      expect(playerIds).toContain(resource.playerId)
    }

    for (const playerId of playerIds) {
      const resources = resourceRows.filter((resource) => resource.playerId === playerId)
      expect(resources).toContainEqual({
        amount: STARTING_RESOURCE_AMOUNTS[ResourceType.MONEY],
        gameId: createdGameId,
        playerId,
        resourceType: ResourceType.MONEY,
      })
    }
  })
})

async function joinThenLeave({
  loadTestServer,
  account,
  gameId,
}: {
  loadTestServer: LoadTestServer
  account: AccountModel
  gameId: number
}): Promise<void> {
  const client = loadTestServer.createClient(account)

  await randomDelay()
  await Result.tryCatch(client.lobbies.join.mutate({ gameId }))
  await randomDelay()
  await Result.tryCatch(client.lobbies.leave.mutate({ gameId }))
}
