import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { compileRuleset } from "../compiler/compileRuleset.ts"
import { executeActions } from "../runtime/executeActions.ts"
import { validateSubmissions } from "../runtime/validateSubmissions.ts"
import { buildActions } from "../test-ruleset/actions/build-fleet.ts"
import { resourceActions } from "../test-ruleset/actions/gain-resources.ts"
import { TestRuleset } from "../test-ruleset/TestRuleset.ts"
import { compileActions, createScenario, extractSuccess, rulesetInput, submit } from "./createScenario.stub.ts"

describe("resource costs", () => {
  it("should reserve cumulative costs across submissions without changing resources", () => {
    // Arrange
    const { state, actor, home } = createScenario()
    actor.resources[ResourceType.INFLUENCE] = 7
    const ruleset = compileActions(buildActions)
    const submissions = [
      submit("BUILD_FLEET_STANDARD", actor.id, { planet: home.id }),
      submit("BUILD_FLEET_IMPROVED", actor.id, { planet: home.id }),
    ]
    // Act
    const result = validateSubmissions(submissions, ruleset, state)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure([{ path: ["submissions", 1, "costs", ResourceType.INFLUENCE], message: "Missing 1 INFLUENCE" }]),
    )
    expect(actor.resources[ResourceType.INFLUENCE]).toBe(7)
  })

  it("should not fund costs with income from another submission", () => {
    // Arrange
    const { state, actor, home } = createScenario()
    actor.resources[ResourceType.INFLUENCE] = 0
    const ruleset = extractSuccess(compileRuleset(TestRuleset))
    const submissions = [submit("GAIN_INFLUENCE", actor.id), submit("BUILD_FLEET_STANDARD", actor.id, { planet: home.id })]
    // Act
    const result = executeActions(ruleset, state, submissions, createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure([{ path: ["submissions", 1, "costs", ResourceType.INFLUENCE], message: "Missing 2 INFLUENCE" }]),
    )
    expect(actor.resources[ResourceType.INFLUENCE]).toBe(0)
  })

  it("should pay all configured costs before gains and returns an independent state", () => {
    // Arrange
    const { state, actor } = createScenario()
    const ruleset = compileActions(resourceActions)
    const submissions = resourceActions.map((action) => submit(action.id, actor.id))
    // Act
    const result = executeActions(ruleset, state, submissions, createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            players: expect.objectContaining({
              [actor.id]: { id: actor.id, resources: { INFLUENCE: 99, METAL: 103, FUEL: 104, ENERGY: 105, COLONY: 0 } },
            }),
          }),
        }),
      ),
    )
    expect(actor.resources).toStrictEqual({ INFLUENCE: 100, METAL: 100, FUEL: 100, ENERGY: 100, COLONY: 0 })
  })

  it("should accept fractional resource costs using the domain resource schema", () => {
    // Arrange
    const { state, actor } = createScenario()
    actor.resources[ResourceType.COLONY] = 1
    const action = { ...resourceActions[0], costs: [{ resourceType: ResourceType.COLONY, quantity: 0.25 }] }
    const ruleset = compileActions([action])
    // Act
    const result = executeActions(ruleset, state, [submit(action.id, actor.id)], createSeededRng)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          state: expect.objectContaining({
            players: expect.objectContaining({
              [actor.id]: expect.objectContaining({ resources: expect.objectContaining({ COLONY: 0.75 }) }),
            }),
          }),
        }),
      ),
    )
  })

  it("should include spending authored as a mechanic in cumulative affordability", () => {
    // Arrange
    const { state, actor } = createScenario()
    const action = {
      ...resourceActions[0],
      costs: [{ quantity: 60, resourceType: ResourceType.METAL }],
      mechanics: [{ use: "spendResources", bind: {}, parameters: { quantity: 50, resourceType: ResourceType.METAL } }],
    }
    const ruleset = extractSuccess(compileRuleset(rulesetInput([action])))
    // Act
    const result = executeActions(ruleset, state, [submit(action.id, actor.id)], createSeededRng)
    // Assert
    expect(result).toStrictEqual(Result.Failure([{ path: ["submissions", 0, "costs", ResourceType.METAL], message: "Missing 10 METAL" }]))
  })
})
