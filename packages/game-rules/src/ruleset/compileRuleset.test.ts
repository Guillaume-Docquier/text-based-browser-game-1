import { indexBy } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createActionDefinitionStub } from "#game-rules/ruleset/action-definitions/ActionDefinition.stub.ts"
import { compileRuleset } from "#game-rules/ruleset/compileRuleset.ts"
import { createResourcesStub } from "#game-rules/ruleset/effect-definitions/Resources.stub.ts"
import { Ruleset } from "#game-rules/ruleset/Ruleset.ts"

describe("compileRuleset", () => {
  it("should assign distinct, deterministic IDs to Action Pool entries without changing the authored Ruleset", () => {
    // Arrange
    const definition = createActionDefinitionStub({ id: "BUILD_FLEET" })
    const ruleset = Ruleset.create({
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions: indexBy("id", [definition]),
      actionPool: [{ actionDefinitionId: definition.id }, { actionDefinitionId: definition.id }],
      startingResources: createResourcesStub(),
    })

    // Act
    const firstCompilation = compileRuleset(ruleset)
    const secondCompilation = compileRuleset(ruleset)

    // Assert
    expect(ruleset.actionPool).toStrictEqual([{ actionDefinitionId: definition.id }, { actionDefinitionId: definition.id }])
    expect(firstCompilation.actionPool).toStrictEqual([
      { id: "c2497fb8-a65a-521f-8a3c-b3868954ebe9", actionDefinitionId: definition.id },
      { id: "5d97ef3c-f6d9-5e3e-9eec-47aa699adc57", actionDefinitionId: definition.id },
    ])
    expect(secondCompilation).toStrictEqual(firstCompilation)
  })

  it("should preserve IDs when an unrelated definition is inserted and support maximum-length definition IDs", () => {
    // Arrange
    const firstDefinition = createActionDefinitionStub({ id: "A".repeat(36) })
    const secondDefinition = createActionDefinitionStub({ id: "B" })
    const actionDefinitions = indexBy("id", [firstDefinition, secondDefinition])
    const baseRuleset = Ruleset.create({
      id: "test-ruleset",
      name: "Test Ruleset",
      isDefault: false,
      actionDefinitions,
      actionPool: [{ actionDefinitionId: firstDefinition.id }, { actionDefinitionId: firstDefinition.id }],
      startingResources: createResourcesStub(),
    })
    const expandedRuleset = Ruleset.create({
      ...baseRuleset,
      actionPool: [
        { actionDefinitionId: secondDefinition.id },
        { actionDefinitionId: firstDefinition.id },
        { actionDefinitionId: firstDefinition.id },
      ],
    })

    // Act
    const originalIds = compileRuleset(baseRuleset).actionPool.map((action) => action.id)
    const expandedIds = compileRuleset(expandedRuleset).actionPool.map((action) => action.id)

    // Assert
    expect(expandedIds.slice(1)).toStrictEqual(originalIds)
    expect(originalIds.every((id) => id.length === 36)).toBe(true)
  })
})
