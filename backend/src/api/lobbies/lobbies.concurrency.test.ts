import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import { MAX_NB_SEATS } from "#api/lobbies/lobbies.controller.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"

const NB_CONCURRENCY_TEST_ACCOUNTS = MAX_NB_SEATS

describe("lobby concurrency", () => {
  it("should enforce the seat count when multiple accounts join the same game concurrently", async () => {
    // Arrange
    await using concurrencyTestApiServer = await ConcurrencyTestApiServer.create()
    const [creator, ...participants] = await Promise.all(
      Array.from(
        { length: NB_CONCURRENCY_TEST_ACCOUNTS },
        async () => await concurrencyTestApiServer.createClient({ authenticated: true }),
      ),
    )
    Assert.isDefined(creator)

    const { createdGameId } = await creator.client.lobbies.create.mutate({
      configuration: createLobbyConfigurationDtoStub({ nbSeats: 4 }),
    })

    // Act
    await Promise.allSettled(
      participants.map(async (participant) => {
        await participant.client.lobbies.join.mutate({ gameId: createdGameId })
      }),
    )

    // Assert
    const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
    expect(lobby.players).toHaveLength(4)
  })

  it("should keep started-game resources consistent while accounts join and leave concurrently", async () => {
    // Arrange
    await using concurrencyTestApiServer = await ConcurrencyTestApiServer.create()
    const [creator, ...participants] = await Promise.all(
      Array.from(
        { length: NB_CONCURRENCY_TEST_ACCOUNTS },
        async () => await concurrencyTestApiServer.createClient({ authenticated: true }),
      ),
    )
    Assert.isDefined(creator)

    const { createdGameId } = await creator.client.lobbies.create.mutate({
      configuration: createLobbyConfigurationDtoStub({ nbSeats: NB_CONCURRENCY_TEST_ACCOUNTS }),
    })

    // Act
    await Promise.all([
      ...participants.map(async (participant) => {
        await Result.tryCatch(participant.client.lobbies.join.mutate({ gameId: createdGameId }))
        await Result.tryCatch(participant.client.lobbies.leave.mutate({ gameId: createdGameId }))
      }),
      creator.client.gameplay.startGame.mutate({ gameId: createdGameId }),
    ])

    // Assert
    const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
    const participantsMap = new Map(
      [creator, ...participants].map((participant) => [branded<PlayerId>(participant.account.id), participant]),
    )
    const gameParticipants = lobby.players
      .toSorted((left, right) => left.id.localeCompare(right.id))
      .map((player) => participantsMap.get(player.id))

    for (const gameParticipant of gameParticipants) {
      Assert.isDefined(gameParticipant)
      const playerView = await gameParticipant.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView.resources).toStrictEqual<typeof playerView.resources>(
        createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 3, total: 3 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
        }),
      )
    }
  })
})
