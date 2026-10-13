import type { Action, PlayerView, Players, GameId } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { SubmittedActionSchema } from "shared/domain/turns/actions/Action.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { createFleetOperationsRuleset } from "shared/testing/FleetOperationsRuleset.stub.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"

/** Reviewed I5 public T12 checkpoint. Only game/player/source identities and display names are aliases. */
export function createFleetOperationsCardCheckpoint(alternate = false, maximumDistance = 18): { view: PlayerView; players: Players } {
  const right = createPlayerStub({ id: "00000000-0000-4000-8000-000000000001", alias: "Right" }),
    left = createPlayerStub({ id: "00000000-0000-4000-8000-000000000002", alias: "Left" })
  const rightHome = createPlanetStub({
    id: "d40c7e39-481b-51ca-a0de-156e3881fffc",
    name: "Right home",
    coordinates: "46:93:25",
    ownerPlayerId: right.id,
    x: 63.22189724800524,
    y: 49.62838420494031,
  })
  const leftHome = createPlanetStub({
    id: "8ad435bf-768f-5f69-98b6-4313bb12654a",
    name: "Left home",
    coordinates: "44:96:25",
    ownerPlayerId: left.id,
    x: 46.15278531453192,
    y: 49.009213135673384,
  })
  const destination = createPlanetStub({
    id: "18f11e3d-625a-5a0e-84d3-bd8b6d139b1a",
    name: "Unclaimed destination",
    coordinates: "35:35:40",
    ownerPlayerId: null,
    x: 55.17465357641431,
    y: 33.77647841856575,
  })
  const source = createFleetStub({
    id: "right-source",
    name: "Right source",
    ownerPlayerId: right.id,
    originPlanetId: rightHome.id,
    strength: 80,
  })
  const enemy = createFleetStub({
    id: "left-source",
    name: "Left source",
    ownerPlayerId: left.id,
    originPlanetId: leftHome.id,
    strength: 60,
  })
  const ruleset = alternate ? createFleetOperationsRuleset(maximumDistance) : TestRuleset
  const amounts: Record<string, number> = alternate
    ? { EXPAND_1: 35, ENGAGE_1: 30, ENGAGE_2: 10, MOVE_FLEET_EXCEPTIONAL_1: 5 }
    : { COLONIZE_PLANET_STANDARD_1: 35, ATTACK_MOVE_STANDARD_1: 30, MOVE_FLEET_EXCEPTIONAL_1: 5 }
  const actions: Action[] = ruleset.actionPool.map((entry) => {
    const amount = amounts[entry.id]
    if (amount === undefined)
      return { ...entry, status: "AVAILABLE", selectedTargets: null, selectedInputs: null, canAffordResources: true, isEligible: false }
    const configured = alternate && !entry.id.startsWith("MOVE")
    const planet = entry.id.startsWith("EXPAND") || entry.id.startsWith("COLONIZE") ? destination.id : leftHome.id
    const submission = typedParse(SubmittedActionSchema, {
      ...entry,
      playerId: right.id,
      selectedTargets: configured ? { craft: source.id, world: planet } : { fleet: source.id, planet },
      selectedInputs: configured ? { force: amount } : { strength: amount },
    })
    return { ...submission, status: "SUBMITTED", canAffordResources: true, isEligible: true }
  })
  return {
    players: [right, left],
    view: {
      gameId: branded<GameId>(1),
      turn: 12,
      turnStatus: "COLLECTING_ACTIONS",
      turnEndsAt: "2099-01-01T00:00:00.000Z",
      player: { id: right.id, color: right.color, isReady: false },
      opponents: { [left.id]: { id: left.id, color: left.color, isReady: false } },
      galaxy: {
        systems: [{ star: createStarStub({ id: "checkpoint-star", name: "Checkpoint" }), planets: [rightHome, leftHome, destination] }],
      },
      fleets: [source, enemy],
      ruleset,
      actions,
      resources: {
        INFLUENCE: { total: 38, uncommitted: alternate ? 3 : 5 },
        METAL: { total: 2, uncommitted: 2 },
        FUEL: { total: 6, uncommitted: alternate ? 1 : 0 },
        ENERGY: { total: 0, uncommitted: 0 },
        COLONY: { total: 0, uncommitted: 0 },
      },
    },
  }
}
