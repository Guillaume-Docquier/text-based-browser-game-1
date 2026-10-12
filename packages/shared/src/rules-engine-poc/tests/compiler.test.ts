import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { compileRuleset } from "../compiler/compileRuleset.ts"
import { moveActions } from "../test-ruleset/actions/move-fleet.ts"
import { TestRuleset } from "../test-ruleset/TestRuleset.ts"
import { extractSuccess, rulesetInput } from "./createScenario.stub.ts"

describe("ruleset compiler", () => {
  it("should compile independently authored JSON with all eleven actions", () => {
    // Arrange
    const json: unknown = JSON.parse(JSON.stringify(TestRuleset))
    // Act
    const result = compileRuleset(json)
    // Assert
    expect(result).toStrictEqual(
      Result.Success(
        expect.objectContaining({
          actions: expect.any(Map),
          definition: expect.objectContaining({ actionDefinitions: expect.any(Array) }),
        }),
      ),
    )
    expect(extractSuccess(result).actions.size).toBe(11)
  })

  it.each([
    ["unknown mechanic", { use: "missing", bind: {}, parameters: {} }, ["use"]],
    ["missing binding", { use: "moveFleet", bind: { fleet: "fleet" }, parameters: { speed: 1 } }, ["bind", "destination"]],
    [
      "unknown slot",
      { use: "moveFleet", bind: { fleet: "fleet", destination: "planet", extra: "fleet" }, parameters: { speed: 1 } },
      ["bind", "extra"],
    ],
    ["wrong kind", { use: "moveFleet", bind: { fleet: "planet", destination: "planet" }, parameters: { speed: 1 } }, ["bind", "fleet"]],
    ["unknown target", { use: "moveFleet", bind: { fleet: "typo", destination: "planet" }, parameters: { speed: 1 } }, ["bind", "fleet"]],
    [
      "zero speed",
      { use: "moveFleet", bind: { fleet: "fleet", destination: "planet" }, parameters: { speed: 0 } },
      ["parameters", "speed"],
    ],
    [
      "negative speed",
      { use: "moveFleet", bind: { fleet: "fleet", destination: "planet" }, parameters: { speed: -1 } },
      ["parameters", "speed"],
    ],
    [
      "extra parameter",
      { use: "moveFleet", bind: { fleet: "fleet", destination: "planet" }, parameters: { speed: 1, typo: true } },
      ["parameters"],
    ],
    ["fractional strength", { use: "buildFleet", bind: { planet: "planet" }, parameters: { strength: 1.5 } }, ["parameters", "strength"]],
    ["zero strength", { use: "buildFleet", bind: { planet: "planet" }, parameters: { strength: 0 } }, ["parameters", "strength"]],
    [
      "bad resource",
      { use: "gainResources", bind: {}, parameters: { quantity: 5, resourceType: "unknown" } },
      ["parameters", "resourceType"],
    ],
    ["negative gain", { use: "gainResources", bind: {}, parameters: { quantity: -1, resourceType: "METAL" } }, ["parameters", "quantity"]],
    ["inherited mechanic", { use: "constructor", bind: {}, parameters: {} }, ["use"]],
  ])("should reject %s with the invocation path", (_label, invocation, suffix) => {
    // Arrange
    const input = rulesetInput([{ ...moveActions[0], mechanics: [invocation] }])
    // Act
    const result = compileRuleset(input)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(expect.arrayContaining([expect.objectContaining({ path: ["actionDefinitions", 0, "mechanics", 0, ...suffix] })])),
    )
  })

  it.each([
    { kind: "strengthAtLeast", fleet: "planet", value: 10 },
    { kind: "ownedByActor", target: "missing" },
    { kind: "inRange", fleet: "fleet", planet: "fleet", range: 5 },
    { kind: "different", a: "fleet", b: "missing" },
  ])("should reject incompatible or undeclared constraint references: $kind", (constraint) => {
    // Arrange
    const input = { ...rulesetInput([]), actionDefinitions: [{ ...moveActions[0], constraints: [constraint] }] }
    // Act
    const result = compileRuleset(input)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(expect.arrayContaining([expect.objectContaining({ path: expect.arrayContaining(["constraints"]) })])),
    )
  })

  it("should expand mechanic ownership requirements without action-authored ownership", () => {
    // Arrange
    const input = rulesetInput([moveActions[0]])
    // Act
    const compiled = extractSuccess(compileRuleset(input))
    // Assert
    expect(compiled.actions.get("MOVE_FLEET_STANDARD")?.constraints).toStrictEqual([
      { kind: "ownedByActor", target: { name: "fleet", kind: "fleet" } },
    ])
  })

  it("should reject duplicate definitions and opportunities and dangling pool references", () => {
    // Arrange
    const action = moveActions[0]
    const input = {
      ...rulesetInput([action, action]),
      actionPool: [
        { id: "same", actionDefinitionId: action.id },
        { id: "same", actionDefinitionId: "missing" },
      ],
    }
    // Act
    const result = compileRuleset(input)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure([
        { path: ["actionDefinitions", 1, "id"], message: "Duplicate action definition ID" },
        { path: ["actionPool", 1, "id"], message: "Duplicate pooled action ID" },
        { path: ["actionPool", 1, "actionDefinitionId"], message: "Unknown action definition" },
      ]),
    )
  })

  it.each([0, -1, Infinity, NaN])("should reject invalid cost quantity %s", (quantity) => {
    // Arrange
    const input = { ...rulesetInput([]), actionDefinitions: [{ ...moveActions[0], costs: [{ quantity, resourceType: "FUEL" }] }] }
    // Act
    const result = compileRuleset(input)
    // Assert
    expect(result).toStrictEqual(
      Result.Failure(expect.arrayContaining([expect.objectContaining({ path: ["actionDefinitions", 0, "costs", 0, "quantity"] })])),
    )
  })

  it("should reject malformed data before semantic compilation", () => {
    // Arrange
    const input = { actionDefinitions: "not an array" }
    // Act
    const result = compileRuleset(input)
    // Assert
    expect(result).toStrictEqual(Result.Failure(expect.arrayContaining([expect.objectContaining({ path: ["actionDefinitions"] })])))
  })
})
