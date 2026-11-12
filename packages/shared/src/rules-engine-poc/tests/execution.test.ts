import { indexBy, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { compileRuleset } from "../compiler/compileRuleset.ts"
import { defineMechanic } from "../definitions/defineMechanic.ts"
import { mechanicRegistry } from "../mechanics/mechanicRegistry.ts"
import { executeActions } from "../runtime/executeActions.ts"
import { buildActions } from "../test-ruleset/actions/build-fleet.ts"
import { resourceActions } from "../test-ruleset/actions/gain-resources.ts"
import { moveActions } from "../test-ruleset/actions/move-fleet.ts"
import { winAction } from "../test-ruleset/actions/win-the-game.ts"
import { compileActions, createScenario, extractSuccess, rulesetInput, submit } from "./createScenario.stub.ts"

describe("mechanic execution", () => {
  it.each(buildActions)("should reinforce a stationed fleet for $id", (action) => {
    // Arrange
    const { state, actor, home, fleetA } = createScenario()
    const ruleset = compileActions([action])
    // Act
    const result = executeActions(ruleset, state, [submit(action.id, actor.id, { planet: home.id })], createSeededRng)
    // Assert
    const expectedStrengths: Record<string, number> = {
      BUILD_FLEET_STANDARD: 30,
      BUILD_FLEET_IMPROVED: 120,
      BUILD_FLEET_EXCEPTIONAL: 1020,
    }
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, strength: expectedStrengths[action.id] },
            }),
          }),
        }),
      ),
    )
    expect(fleetA.strength).toBe(20)
  })

  it("should create the same fleet identity and name on replay", () => {
    // Arrange
    const { state, actor, home } = createScenario()
    const input = { ...state, fleets: {} }
    const action = buildActions[0]
    const ruleset = compileActions([action])
    const submissions = [submit(action.id, actor.id, { planet: home.id })]
    // Act
    const first = executeActions(ruleset, input, submissions, createSeededRng)
    const second = executeActions(ruleset, input, submissions, createSeededRng)
    // Assert
    expect(first).toStrictEqual(second)
    expect(first).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({ fleets: expect.any(Object) }),
        }),
      ),
    )
    expect(Object.values(extractSuccess(first).state.fleets)).toStrictEqual([
      expect.objectContaining({
        ownerPlayerId: actor.id,
        originPlanetId: home.id,
        strength: 10,
        name: expect.stringMatching(/^fleet \d+$/),
      }),
    ])
  })

  it.each([
    [moveActions[0], 4.9],
    [moveActions[1], 4],
  ] as const)("should advance a fleet by the configured speed", (action, remaining) => {
    // Arrange
    const { state, actor, fleetA, destination } = createScenario()
    const ruleset = compileActions([action])
    // Act
    const result = executeActions(
      ruleset,
      state,
      [submit(action.id, actor.id, { fleet: fleetA.id, planet: destination.id })],
      createSeededRng,
    )
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, destinationPlanetId: destination.id, distanceToEnd: remaining },
            }),
          }),
        }),
      ),
    )
  })

  it("should land a fleet when speed covers the remaining distance", () => {
    // Arrange
    const { state, actor, fleetA, destination } = createScenario()
    const action = moveActions[2]
    const ruleset = compileActions([action])
    // Act
    const result = executeActions(
      ruleset,
      state,
      [submit(action.id, actor.id, { fleet: fleetA.id, planet: destination.id })],
      createSeededRng,
    )
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, originPlanetId: destination.id, destinationPlanetId: undefined, distanceToEnd: undefined },
            }),
          }),
        }),
      ),
    )
  })

  it("should merge on arrival into a friendly stationed fleet", () => {
    // Arrange
    const { state, actor, fleetA, fleetB, destination } = createScenario()
    fleetB.originPlanetId = destination.id
    const action = moveActions[2]
    const ruleset = compileActions([action])
    // Act
    const result = executeActions(
      ruleset,
      state,
      [submit(action.id, actor.id, { fleet: fleetA.id, planet: destination.id })],
      createSeededRng,
    )
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, strength: 0, destinationPlanetId: destination.id, distanceToEnd: 0 },
              [fleetB.id]: { ...fleetB, strength: 50 },
            }),
          }),
        }),
      ),
    )
  })

  it("should preserve per-submission movement on later turns", () => {
    // Arrange
    const { state, actor, fleetA, destination } = createScenario()
    const action = moveActions[1]
    const ruleset = compileActions([action])
    const submissions = [submit(action.id, actor.id, { fleet: fleetA.id, planet: destination.id })]
    const first = extractSuccess(executeActions(ruleset, state, submissions, createSeededRng))
    // Act
    const result = executeActions(ruleset, { ...first.state, turn: 2 }, submissions, createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            fleets: expect.objectContaining({
              [fleetA.id]: { ...fleetA, destinationPlanetId: destination.id, distanceToEnd: 3 },
            }),
          }),
        }),
      ),
    )
  })

  it("should prevent a later victory attempt but still pays its cost", () => {
    // Arrange
    const { state, actor, opponent } = createScenario()
    const ruleset = compileActions([winAction])
    const submissions = [submit(winAction.id, actor.id), submit(winAction.id, opponent.id)]
    // Act
    const result = executeActions(ruleset, state, submissions, createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            winnerPlayerId: actor.id,
            players: expect.objectContaining({
              [opponent.id]: expect.objectContaining({ resources: expect.objectContaining({ INFLUENCE: 90 }) }),
            }),
          }),
          outcomes: [
            {
              submission: submissions[0],
              outcomes: [
                { status: "resolved", message: "Spent 10 INFLUENCE" },
                { status: "resolved", message: "Spent 5 METAL" },
                { status: "resolved", message: "Spent 5 ENERGY" },
                { status: "resolved", message: "Spent 5 FUEL" },
                { status: "resolved", message: "Won the game" },
              ],
            },
            {
              submission: submissions[1],
              outcomes: [
                { status: "resolved", message: "Spent 10 INFLUENCE" },
                { status: "resolved", message: "Spent 5 METAL" },
                { status: "resolved", message: "Spent 5 ENERGY" },
                { status: "resolved", message: "Spent 5 FUEL" },
                { status: "prevented", message: `Player ${actor.id} already won` },
              ],
            },
          ],
        }),
      ),
    )
  })

  it("should discard earlier costs and mutations if a later mechanic fails", () => {
    // Arrange
    const { state, actor, home } = createScenario()
    const input = { ...state, fleets: {} }
    const fail = defineMechanic({
      targets: {},
      parameters: mechanicRegistry.winGame.parameterSchema,
      phase: "victory",
      requirements: () => [],
      resolve: () => Result.Failure([{ path: ["failure"], message: "Deliberate test failure" }]),
    })
    const action = {
      ...buildActions[0],
      mechanics: [
        { use: "buildFleet", bind: { planet: "planet" }, parameters: { strength: 10 } },
        { use: "fail", bind: {}, parameters: {} },
      ],
    }
    const ruleset = extractSuccess(compileRuleset(rulesetInput([action]), { ...mechanicRegistry, fail }))
    const submissions = [submit(action.id, actor.id, { planet: home.id })]
    const before = structuredClone(input)
    // Act
    const result = executeActions(ruleset, input, submissions, createSeededRng)
    const retry = executeActions(ruleset, input, submissions, createSeededRng)
    // Assert
    expect(result).toStrictEqual(Result.Failure([{ path: ["failure"], message: "Deliberate test failure" }]))
    expect(retry).toStrictEqual(result)
    expect(input).toStrictEqual(before)
  })

  it.each([
    ["foreign owned planet", "BUILD_FLEET_STANDARD", { planet: "foreign" }],
    ["hostile fleet", "MOVE_FLEET_STANDARD", { fleet: "hostile", planet: "destination" }],
    ["unknown fleet", "MOVE_FLEET_STANDARD", { fleet: "missing", planet: "destination" }],
    ["wrong entity kind", "MOVE_FLEET_STANDARD", { fleet: "home", planet: "destination" }],
    ["extra selection", "BUILD_FLEET_STANDARD", { planet: "home", extra: "home" }],
    ["missing selection", "BUILD_FLEET_STANDARD", {}],
  ])("should reject %s before paying costs", (_label, id, targets) => {
    // Arrange
    const { state, actor } = createScenario()
    const ruleset = compileActions([...buildActions, ...moveActions])
    const before = structuredClone(state)
    // Act
    const result = executeActions(ruleset, state, [submit(id, actor.id, targets)], createSeededRng)
    // Assert
    expect(result).toStrictEqual(Result.Failure(expect.arrayContaining([expect.objectContaining({ path: expect.any(Array) })])))
    expect(state).toStrictEqual(before)
  })

  it("should reject an unavailable or duplicate opportunity", () => {
    // Arrange
    const { state, actor } = createScenario()
    const ruleset = compileActions([resourceActions[0]])
    const submission = submit("GAIN_INFLUENCE", actor.id)
    // Act
    const duplicate = executeActions(ruleset, state, [submission, submission], createSeededRng)
    const unavailable = executeActions(ruleset, state, [{ ...submission, id: submit("unavailable", actor.id).id }], createSeededRng)
    // Assert
    expect(duplicate).toStrictEqual(Result.Failure([{ path: ["submissions", 1, "id"], message: "Action opportunity already submitted" }]))
    expect(unavailable).toStrictEqual(Result.Failure([{ path: ["submissions", 0, "id"], message: "Action is not available in the pool" }]))
  })

  it("should keep resource validation scoped to each acting player", () => {
    // Arrange
    const { state, actor, opponent } = createScenario()
    actor.resources[ResourceType.INFLUENCE] = 0
    const input = { ...state, players: indexBy("id", [actor, opponent]) }
    const ruleset = compileActions([winAction])
    // Act
    const result = executeActions(ruleset, input, [submit(winAction.id, actor.id)], createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure([{ path: ["submissions", 0, "costs", ResourceType.INFLUENCE], message: "Missing 10 INFLUENCE" }]),
    )
  })
})
