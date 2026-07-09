import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { afterEach, describe, expect, it } from "vitest"
import type { AccountModel } from "#api/accounts/accounts.repository.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import {
  createAccounts,
  createLoadTestServer,
  ignoreExpectedRequestFailures,
  randomDelay,
  type LoadTestServer,
} from "#tests/loadTestHarness.ts"

const NB_LOAD_TEST_ACCOUNTS = 20

describe("lobby concurrency load tests", () => {
  let server: LoadTestServer | undefined

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

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
    const players = lobby.players.toSorted((left, right) => left.id.localeCompare(right.id))

    for (const player of players) {
      const account = accounts.find((candidate) => candidate.id === player.id)
      Assert.isDefined(account)

      const playerView = await loadTestServer.createClient(account).gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView.resources).toEqual({ money: STARTING_RESOURCE_AMOUNTS.MONEY })
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
