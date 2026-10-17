import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { compileRuleset } from "../compiler/compileRuleset.ts"
import { defineAction } from "../definitions/defineAction.ts"
import { defineMechanic } from "../definitions/defineMechanic.ts"
import { mechanicRegistry } from "../mechanics/mechanicRegistry.ts"
import { executeActions } from "../runtime/executeActions.ts"
import { compileActions, createScenario, extractSuccess, rulesetInput, submit } from "./createScenario.stub.ts"

const advance = defineAction(mechanicRegistry, {
  id: "ADVANCE",
  name: "Coordinated Advance",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  targets: { fleetA: "fleet", fleetB: "fleet", planetA: "planet" },
  costs: [{ resourceType: ResourceType.FUEL, quantity: 2 }],
  constraints: [
    { kind: "different", a: "fleetA", b: "fleetB" },
    { kind: "strengthAtLeast", fleet: "fleetB", value: 25 },
  ],
  mechanics: [
    { use: "moveFleet", bind: { fleet: "fleetA", destination: "planetA" }, parameters: { speed: 1 } },
    { use: "moveFleet", bind: { fleet: "fleetB", destination: "planetA" }, parameters: { speed: 2 } },
  ],
})

describe("mechanic composition", () => {
  it("should move two distinct fleets using a shared destination and different parameters", () => {
    // Arrange
    const { state, actor, fleetA, fleetB, destination } = createScenario()
    const ruleset = compileActions([advance])
    const submission = submit(advance.id, actor.id, { fleetA: fleetA.id, fleetB: fleetB.id, planetA: destination.id })
    // Act
    const result = executeActions(ruleset, state, [submission], createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, destinationPlanetId: destination.id, distanceToEnd: 4 },
              [fleetB.id]: { ...fleetB, destinationPlanetId: destination.id, distanceToEnd: 3 },
            }),
            players: expect.objectContaining({
              [actor.id]: expect.objectContaining({ resources: expect.objectContaining({ FUEL: 98 }) }),
            }),
          }),
        }),
      ),
    )
  })

  it("should enforce author-defined restrictions in addition to mandatory requirements", () => {
    // Arrange
    const { state, actor, fleetA, destination } = createScenario()
    const ruleset = compileActions([advance])
    const submission = submit(advance.id, actor.id, { fleetA: fleetA.id, fleetB: fleetA.id, planetA: destination.id })
    // Act
    const result = executeActions(ruleset, state, [submission], createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        { path: ["submissions", 0, "constraints", 2], message: "Constraint violated" },
        { path: ["submissions", 0, "constraints", 3], message: "Constraint violated" },
      ]),
    )
  })

  it("should share a target across different mechanics while phase order controls execution", () => {
    // Arrange
    const { state, actor, home, fleetA, fleetB } = createScenario()
    const action = defineAction(mechanicRegistry, {
      id: "MOVE_AND_BUILD",
      name: "Move and build",
      type: ActionType.DIRECTIVE,
      tier: ActionTier.STANDARD,
      targets: { departing: "fleet", home: "planet" },
      constraints: [],
      costs: [],
      // Build is listed first, but Movement is an earlier engine-owned phase.
      mechanics: [
        { use: "buildFleet", bind: { planet: "home" }, parameters: { strength: 10 } },
        { use: "moveFleet", bind: { fleet: "departing", destination: "home" }, parameters: { speed: 1 } },
      ],
    })
    const ruleset = compileActions([action])
    const submission = submit(action.id, actor.id, { departing: fleetA.id, home: home.id })
    // Act
    const result = executeActions(ruleset, state, [submission], createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, strength: 0, destinationPlanetId: home.id, distanceToEnd: 0 },
              [fleetB.id]: { ...fleetB, strength: 60 },
            }),
          }),
          outcomes: [
            {
              submission,
              outcomes: [
                { status: "resolved", message: "Moved fleet by 0" },
                { status: "resolved", message: "Fleet merged" },
                { status: "resolved", message: "Reinforced fleet by 10" },
              ],
            },
          ],
        }),
      ),
    )
  })

  it("should resolve a player slot to the existing player and resource domain types", () => {
    // Arrange
    const { state, actor, opponent } = createScenario()
    const transfer = defineMechanic({
      targets: { recipient: "player" },
      parameters: z.strictObject({}),
      phase: "income",
      requirements: () => [],
      resolve: ({ recipient }, _parameters, context) => {
        context.actor.resources[ResourceType.METAL] -= 1
        recipient.resources[ResourceType.METAL] += 1
        return Result.Success([{ status: "resolved", message: "Transferred metal" }])
      },
    })
    const registry = { ...mechanicRegistry, transfer }
    const action = defineAction(registry, {
      id: "TRANSFER",
      name: "Transfer",
      type: ActionType.DIRECTIVE,
      tier: ActionTier.BASIC,
      targets: { otherPlayer: "player" },
      constraints: [],
      costs: [],
      mechanics: [{ use: "transfer", bind: { recipient: "otherPlayer" }, parameters: {} }],
    })
    const ruleset = extractSuccess(compileRuleset(rulesetInput([action]), registry))
    // Act
    const result = executeActions(ruleset, state, [submit(action.id, actor.id, { otherPlayer: opponent.id })], createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            players: expect.objectContaining({
              [actor.id]: expect.objectContaining({ resources: expect.objectContaining({ METAL: 99 }) }),
              [opponent.id]: expect.objectContaining({ resources: expect.objectContaining({ METAL: 101 }) }),
            }),
          }),
        }),
      ),
    )
  })

  it("should recheck mandatory requirements after an earlier mechanic changes ownership", () => {
    // Arrange
    const { state, actor, opponent, fleetA, destination } = createScenario()
    const giveFleet = defineMechanic({
      targets: { fleet: "fleet", recipient: "player" },
      parameters: z.strictObject({}),
      phase: "fleetMovement",
      requirements: (refs) => [{ kind: "ownedByActor", target: refs.fleet }],
      resolve: ({ fleet, recipient }) => {
        fleet.ownerPlayerId = recipient.id
        return Result.Success([{ status: "resolved", message: "Transferred fleet" }])
      },
    })
    const registry = { ...mechanicRegistry, giveFleet }
    const action = defineAction(registry, {
      id: "GIVE_THEN_MOVE",
      name: "Give then move",
      type: ActionType.DIRECTIVE,
      tier: ActionTier.STANDARD,
      targets: { fleet: "fleet", recipient: "player", destination: "planet" },
      costs: [{ resourceType: ResourceType.FUEL, quantity: 1 }],
      constraints: [],
      mechanics: [
        { use: "giveFleet", bind: { fleet: "fleet", recipient: "recipient" }, parameters: {} },
        { use: "moveFleet", bind: { fleet: "fleet", destination: "destination" }, parameters: { speed: 5 } },
      ],
    })
    const ruleset = extractSuccess(compileRuleset(rulesetInput([action]), registry))
    const submission = submit(action.id, actor.id, { fleet: fleetA.id, recipient: opponent.id, destination: destination.id })
    // Act
    const result = executeActions(ruleset, state, [submission], createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, ownerPlayerId: opponent.id },
            }),
          }),
          outcomes: [
            {
              submission,
              outcomes: [
                { status: "resolved", message: "Spent 1 FUEL" },
                { status: "resolved", message: "Transferred fleet" },
                { status: "prevented", message: "Mechanic requirements no longer satisfied" },
              ],
            },
          ],
        }),
      ),
    )
  })
})
