import type { GameId, PlayerView } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { FleetMovementSchema } from "shared/domain/world/fleets/FleetMovement.ts"
import { describe, expect, it } from "vitest"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"
import { toActionEligibilityState } from "./actionEligibilityState.ts"
import { createFleetActionCardScenario } from "./components/ActionCard.stub.ts"

describe("player view eligibility projection", () => {
  it("should preserve identity, total resources and journeys while projecting only submitted actions", () => {
    const fixture = createFleetActionCardScenario()
    const opponent = createPlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Bob" })
    const submitted = createSubmittedActionStub({
      id: "X",
      playerId: fixture.view.player.id,
      actionDefinitionId: fixture.scenario.definition.id,
      selectedTargets: { craft: "source", route: "destination" },
      selectedInputs: { force: 20 },
    })
    const journey = fixture.scenario.order("Y", 20)
    const moving = createFleetStub({
      ...fixture.scenario.source,
      id: "moving",
      strength: 20,
      destinationPlanetId: fixture.scenario.destination.id,
      distanceToEnd: 3,
      movement: typedParse(FleetMovementSchema, { type: "FLEET_MOVE", initiatingTurn: 1, submittedAction: journey, speed: 2 }),
    })
    const remainder = createFleetStub({ ...fixture.scenario.source, strength: 30 })
    const view: PlayerView = {
      ...fixture.view,
      gameId: branded<GameId>(596),
      turn: 2,
      opponents: { [opponent.id]: { id: opponent.id, color: opponent.color, isReady: false } },
      fleets: [remainder, moving],
      resources: {
        INFLUENCE: { total: 6, uncommitted: 3 },
        FUEL: { total: 2, uncommitted: 1 },
        METAL: { total: 7, uncommitted: 4 },
        ENERGY: { total: 9, uncommitted: 5 },
        COLONY: { total: 8, uncommitted: 6 },
      },
      actions: [
        {
          ...fixture.view.actions[0],
          status: "SUBMITTED",
          selectedTargets: submitted.selectedTargets,
          selectedInputs: submitted.selectedInputs,
        },
        {
          ...fixture.view.actions[1],
          status: "IN_PROGRESS",
          inProgressFleetId: moving.id,
          destinationPlanetId: moving.destinationPlanetId,
          selectedTargets: journey.selectedTargets,
          selectedInputs: journey.selectedInputs,
        },
        {
          ...fixture.view.actions[2],
          status: "AVAILABLE",
          selectedTargets: submitted.selectedTargets,
          selectedInputs: submitted.selectedInputs,
        },
      ],
    }
    const [origin, destination, second] = fixture.view.galaxy.systems[0].planets

    const state = toActionEligibilityState(view)

    expect(state).toStrictEqual({
      gameId: 596,
      turn: 2,
      players: {
        [fixture.view.player.id]: { id: fixture.view.player.id, resources: { INFLUENCE: 6, FUEL: 2, METAL: 7, ENERGY: 9, COLONY: 8 } },
        [opponent.id]: { id: opponent.id, resources: { INFLUENCE: 6, FUEL: 2, METAL: 7, ENERGY: 9, COLONY: 8 } },
      },
      planets: { origin, destination, second },
      fleets: { source: remainder, moving },
      submittedActions: [submitted],
    })
  })
})
