import { Assert } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"

describe("gameplay concurrency", () => {
  it("should serialize readiness closure and action submission on the current turn", async () => {
    // Arrange
    await using apiServer = await ConcurrencyTestApiServer.create()
    const creator = await apiServer.createClient({ authenticated: true })
    const opponent = await apiServer.createClient({ authenticated: true })
    const { createdGameId } = await creator.client.lobbies.create.mutate({
      configuration: createLobbyConfigurationDtoStub({ nbSeats: 2 }),
    })
    await opponent.client.lobbies.join.mutate({ gameId: createdGameId })
    await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

    const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    const action = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainEnergy.id)
    Assert.isDefined(action)
    await creator.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: true })

    // Act
    const [readyOutcome, actionOutcome] = await Promise.allSettled([
      opponent.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: true }),
      creator.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: action.id,
          targets: {},
        },
      }),
    ])

    // Assert
    expect(readyOutcome.status).toBe("fulfilled")
    expect(["fulfilled", "rejected"]).toContain(actionOutcome.status)

    expect((await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })).turnStatus).toBe("AWAITING_PROCESSING")
  })
})
