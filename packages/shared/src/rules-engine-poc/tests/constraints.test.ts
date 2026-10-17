import { Assert } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { evaluateConstraints } from "../constraints/evaluateConstraints.ts"
import { defineAction } from "../definitions/defineAction.ts"
import { mechanicRegistry } from "../mechanics/mechanicRegistry.ts"
import { compileActions, createScenario } from "./createScenario.stub.ts"

const advance = defineAction(mechanicRegistry, {
  id: "ADVANCE",
  name: "Coordinated Advance",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  targets: { first: "fleet", second: "fleet", destination: "planet" },
  costs: [],
  mechanics: [
    { use: "moveFleet", bind: { fleet: "first", destination: "destination" }, parameters: { speed: 1 } },
    { use: "moveFleet", bind: { fleet: "second", destination: "destination" }, parameters: { speed: 1 } },
  ],
  constraints: [
    { kind: "strengthAtLeast", fleet: "second", value: 25 },
    { kind: "different", a: "first", b: "second" },
    { kind: "inRange", fleet: "first", planet: "destination", range: 5 },
  ],
})

describe("constraint evaluation", () => {
  it.each([
    [{}, ["undetermined", "undetermined", "undetermined", "undetermined", "undetermined"]],
    [{ first: "fleet-a" }, ["satisfied", "undetermined", "undetermined", "undetermined", "undetermined"]],
    [{ destination: "destination" }, ["undetermined", "undetermined", "undetermined", "undetermined", "undetermined"]],
    [
      { first: "fleet-a", second: "fleet-b", destination: "destination" },
      ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
    ],
    [{ first: "fleet-a", second: "fleet-a", destination: "destination" }, ["satisfied", "satisfied", "violated", "violated", "satisfied"]],
    [{ first: "hostile", second: "fleet-b", destination: "destination" }, ["violated", "satisfied", "satisfied", "satisfied", "violated"]],
    [{ first: "fleet-a", second: "fleet-b", destination: "foreign" }, ["satisfied", "satisfied", "satisfied", "satisfied", "violated"]],
    [{ first: "missing" }, ["violated", "undetermined", "undetermined", "violated", "violated"]],
  ])("should evaluate partial or complete assignments %j", (selected, expected) => {
    // Arrange
    const { state, actor } = createScenario()
    const action = compileActions([advance]).actions.get(advance.id)
    Assert.isDefined(action)
    // Act
    const result = evaluateConstraints(action.constraints, selected, actor.id, state)
    // Assert
    expect(result).toStrictEqual(expected)
  })
})
