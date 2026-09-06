import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { FleetIdFactory } from "#lib/rules-engine/turn-resolution/FleetIdFactory.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import { BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet-standard.ts"
import { TestRuleset } from "#lib/rulesets/test/TestRuleset.ts"

describe("FleetBuild resolution", () => {
  const firstPlayerId = branded<PlayerId>("first-player")
  const secondPlayerId = branded<PlayerId>("second-player")
  const planetId = branded<PlanetId>(1)
  const gameId = branded<GameId>(7)

  it("should create a fleet and merge later builds by the same player and planet", () => {
    // Arrange
    const firstBuild = createSubmittedActionStub({
      playerId: firstPlayerId,
      actionDefinitionId: BuildFleetStandard.id,
      targets: { self: firstPlayerId, planet: String(planetId) },
    })
    const secondBuild = createSubmittedActionStub({
      playerId: firstPlayerId,
      actionDefinitionId: BuildFleetStandard.id,
      targets: { self: firstPlayerId, planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [firstBuild, secondBuild],
      players: {
        [firstPlayerId]: {
          id: firstPlayerId,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: 4,
            [ResourceType.METAL]: 2,
          }),
        },
      },
      planets: { [planetId]: { id: planetId } },
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng(), FleetIdFactory.create({ gameId, turn: 2 }))

    // Assert
    expect(Result.isSuccess(result)).toBe(true)
    // oxlint-disable-next-line vitest/no-conditional-in-test -- Narrow the Result before asserting the resolved state.
    if (Result.isFailure(result)) return
    expect(result.value.players[firstPlayerId]?.resources).toStrictEqual(
      createResourcesStub({
        [ResourceType.INFLUENCE]: 0,
        [ResourceType.METAL]: 0,
      }),
    )
    expect(result.value.fleets).toStrictEqual({
      "fleet:7:2:0": {
        id: "fleet:7:2:0",
        playerId: firstPlayerId,
        strength: 20,
        originPlanetId: planetId,
      },
    })
  })

  it("should create separate fleets for different players on the same planet", () => {
    // Arrange
    const firstBuild = createSubmittedActionStub({
      playerId: firstPlayerId,
      actionDefinitionId: BuildFleetStandard.id,
      targets: { self: firstPlayerId, planet: String(planetId) },
    })
    const secondBuild = createSubmittedActionStub({
      playerId: secondPlayerId,
      actionDefinitionId: BuildFleetStandard.id,
      targets: { self: secondPlayerId, planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [firstBuild, secondBuild],
      players: {
        [firstPlayerId]: { id: firstPlayerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 2, [ResourceType.METAL]: 1 }) },
        [secondPlayerId]: { id: secondPlayerId, resources: createResourcesStub({ [ResourceType.INFLUENCE]: 2, [ResourceType.METAL]: 1 }) },
      },
      planets: { [planetId]: { id: planetId } },
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng(), FleetIdFactory.create({ gameId, turn: 3 }))

    // Assert
    expect(Result.isSuccess(result)).toBe(true)
    // oxlint-disable-next-line vitest/no-conditional-in-test -- Narrow the Result before asserting the resolved state.
    if (Result.isFailure(result)) return
    expect(Object.values(result.value.fleets)).toStrictEqual([
      { id: "fleet:7:3:0", playerId: firstPlayerId, strength: 10, originPlanetId: planetId },
      { id: "fleet:7:3:1", playerId: secondPlayerId, strength: 10, originPlanetId: planetId },
    ])
  })

  it("should reject a build that targets a planet outside the game state", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({
      playerId: firstPlayerId,
      actionDefinitionId: BuildFleetStandard.id,
      targets: { self: firstPlayerId, planet: String(planetId) },
    })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [firstPlayerId]: {
          id: firstPlayerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 2, [ResourceType.METAL]: 1 }),
        },
      },
    })

    // Act
    const result = resolveTurn(turnState, TestRuleset, createSeededRng(), FleetIdFactory.create({ gameId, turn: 4 }))

    // Assert
    expect(Result.isFailure(result)).toBe(true)
    // oxlint-disable-next-line vitest/no-conditional-in-test -- Narrow the Result before asserting the failure state.
    if (Result.isSuccess(result)) return
    expect(result.error).toMatchObject({ type: "INVALID_SUBMISSIONS" })
    expect(turnState.fleets).toStrictEqual({})
  })
})
