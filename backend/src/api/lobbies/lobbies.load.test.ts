import { Logger } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { type LobbyPlayerDto } from "#api/lobbies/lobbies.controller.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import { STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { createLoadTestApi } from "#tests/load/loadTestApi.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"

const RACING_ACCOUNTS_COUNT = 20
const LIMITED_SEAT_COUNT = 4

async function ignoreExpectedRaceFailure(operation: Promise<unknown>): Promise<void> {
  await operation.catch(() => undefined)
}

describe("lobbies load tests", () => {
  it("should not allow concurrent joins beyond the game seat count", async () => {
    await using loadTestApi = await createLoadTestApi()
    const creator = extractSuccess(await loadTestApi.accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
    const accounts = await Promise.all(
      Array.from({ length: RACING_ACCOUNTS_COUNT }, async (_, index) =>
        extractSuccess(await loadTestApi.accountsRepository.createAccount(createNewAccountModelStub({ alias: `Player ${index}` }))),
      ),
    )

    using creatorClient = loadTestApi.trpcClientForAccount(creator.id)
    const { createdGameId } = await creatorClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ nbSeats: LIMITED_SEAT_COUNT }),
    })

    await Promise.all(
      accounts.map(async (account) => {
        using client = loadTestApi.trpcClientForAccount(account.id)
        await ignoreExpectedRaceFailure(client.client.lobbies.join.mutate({ gameId: createdGameId }))
      }),
    )

    const lobby = await creatorClient.client.lobbies.getById.query({ gameId: createdGameId })
    expect(lobby.players).toHaveLength(LIMITED_SEAT_COUNT)
  })

  it("should keep started game players and starting resources consistent during concurrent joins and leaves", async () => {
    await using loadTestApi = await createLoadTestApi()
    const creator = extractSuccess(await loadTestApi.accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
    const accounts = await Promise.all(
      Array.from({ length: RACING_ACCOUNTS_COUNT }, async (_, index) =>
        extractSuccess(await loadTestApi.accountsRepository.createAccount(createNewAccountModelStub({ alias: `Player ${index}` }))),
      ),
    )

    using creatorClient = loadTestApi.trpcClientForAccount(creator.id)
    const { createdGameId } = await creatorClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ nbSeats: RACING_ACCOUNTS_COUNT + 1 }),
    })

    await Promise.all([
      creatorClient.client.gameplay.startGame.mutate({ gameId: createdGameId }),
      ...accounts.map(async (account) => {
        using client = loadTestApi.trpcClientForAccount(account.id)
        await ignoreExpectedRaceFailure(client.client.lobbies.join.mutate({ gameId: createdGameId }))
        await ignoreExpectedRaceFailure(client.client.lobbies.leave.mutate({ gameId: createdGameId }))
      }),
    ])

    const lobby = await creatorClient.client.lobbies.getById.query({ gameId: createdGameId })
    expect(lobby.status).toBe(GameStatus.STARTED)

    const resourcesRepository = new ResourcesRepository({ logger: Logger.get(), db: loadTestApi.db })
    const resources = extractSuccess(await resourcesRepository.getResourcesByGameId({ gameId: createdGameId }))
    const playerIds = new Set(lobby.players.map((player: LobbyPlayerDto) => player.id))
    const startingResourceAmounts = Object.values(STARTING_RESOURCE_AMOUNTS).sort((left, right) => left - right)

    expect(resources.every((resource) => playerIds.has(resource.playerId))).toBe(true)
    expect(
      lobby.players.map((player) =>
        resources
          .filter((resource) => resource.playerId === player.id)
          .map((resource) => resource.amount)
          .sort((left, right) => left - right),
      ),
    ).toEqual(lobby.players.map(() => startingResourceAmounts))
  })
})
