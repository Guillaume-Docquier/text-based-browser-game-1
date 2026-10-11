import { Assert, branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createFleetEligibilityScenario } from "#shared/action-submission/actionEligibility.stub.ts"
import { evaluateActionSelection, evaluateSubmittedActions } from "#shared/action-submission/actionEligibility.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset, RulesetSchema } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { FleetSchema } from "#shared/domain/world/fleets/Fleet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { extractSuccess } from "#shared/testing/extractSuccess.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"

// Literal budget oracles protect pre-payment aggregate validation and the phase boundary.
describe("independent fleet allocation boundary regressions", () => {
  it("should sum repeated resource costs separately for each player sharing one pooled instance", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario({ influence: 5 })
    const definition = createActionDefinitionStub({
      ...fixture.definition,
      costs: [
        ResourceLossEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 3 }),
        ResourceLossEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 2 }),
        ResourceLossEffectDefinition.create({ resourceType: "FUEL", quantity: 1 }),
      ],
    })
    const ruleset = Ruleset.create({ ...fixture.ruleset, actionDefinitions: { [definition.id]: definition } })
    const otherId = branded<PlayerId>("00000000-0000-4000-8000-000000000002")
    const originalPlayer = fixture.state.players[fixture.playerId]
    Assert.isDefined(originalPlayer)
    const otherSource = { ...fixture.source, id: branded<typeof fixture.source.id>("other-source"), ownerPlayerId: otherId }
    const own = fixture.order("X", 20)
    const other = { ...own, playerId: otherId, selectedTargets: { ...own.selectedTargets, craft: otherSource.id } }
    const state = {
      ...fixture.state,
      players: { ...fixture.state.players, [otherId]: { id: otherId, resources: { ...originalPlayer.resources, INFLUENCE: 4 } } },
      fleets: { ...fixture.state.fleets, [otherSource.id]: otherSource },
    }
    const before = structuredClone(state)

    // Act
    const evaluations = evaluateSubmittedActions({ state, ruleset, submittedActions: [own, other] })
    const reversed = evaluateSubmittedActions({ state, ruleset, submittedActions: [other, own] })

    // Assert
    const shortage = [{ path: ["resources", "INFLUENCE"], status: "invalid", message: "Insufficient INFLUENCE: shortfall 1", shortfall: 1 }]
    expect(evaluations.map((evaluation) => evaluation.issues)).toStrictEqual([[], shortage])
    expect(reversed.map((evaluation) => evaluation.issues)).toStrictEqual([shortage, []])
    expect(state).toStrictEqual(before)
  })

  it("should reserve two costs once, reject a third, and pay precisely 6 Influence and 2 Fuel", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const pair = [fixture.order("X", 20), fixture.order("Y", 30)]
    // Act
    const third = evaluateActionSelection({
      state: { ...fixture.state, submittedActions: pair },
      ruleset: fixture.ruleset,
      action: fixture.order("Z", 1),
      selection: fixture.order("Z", 1),
      mode: "complete",
    })
    const resolved = extractSuccess(
      resolveTurn(structuredClone({ ...fixture.state, submittedActions: pair }), fixture.ruleset, createSeededRng()),
    )
    // Assert
    expect(third.issues).toContainEqual({
      path: ["resources", "INFLUENCE"],
      status: "invalid",
      message: "Insufficient INFLUENCE: shortfall 3",
      shortfall: 3,
    })
    expect(third.issues).toContainEqual({
      path: ["resources", "FUEL"],
      status: "invalid",
      message: "Insufficient FUEL: shortfall 1",
      shortfall: 1,
    })
    expect(resolved.players[fixture.playerId]?.resources).toMatchObject({ INFLUENCE: 0, FUEL: 0 })
    expect(fixture.state.players[fixture.playerId]?.resources).toMatchObject({ INFLUENCE: 6, FUEL: 2 })
  })

  it("should reject departure before payment even when a same-turn gain would cover its shortfall", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario({ influence: 5 })
    const gain = createActionDefinitionStub({
      id: "renamed-income",
      effects: [ResourceGainEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 100 })],
    })
    const ruleset = Ruleset.create({
      ...fixture.ruleset,
      actionDefinitions: { ...fixture.ruleset.actionDefinitions, [gain.id]: gain },
      actionPool: [...fixture.ruleset.actionPool, { id: "income-instance", actionDefinitionId: gain.id }],
    })
    const submissions = [
      fixture.order("X", 20),
      fixture.order("Y", 30),
      createSubmittedActionStub({ id: "income-instance", playerId: fixture.playerId, actionDefinitionId: gain.id }),
    ]
    // Act
    const issues = evaluateSubmittedActions({ state: fixture.state, ruleset, submittedActions: submissions })
    const result = resolveTurn(structuredClone({ ...fixture.state, submittedActions: submissions }), ruleset, createSeededRng())
    // Assert
    expect(issues[0]?.issues).toContainEqual(expect.objectContaining({ path: ["resources", "INFLUENCE"], shortfall: 1 }))
    expect(result).toStrictEqual(Result.Failure(expect.objectContaining({ type: "INVALID_SUBMISSIONS" })))
    expect(fixture.source.strength).toBe(50)
    expect(fixture.state.players[fixture.playerId]?.resources.INFLUENCE).toBe(5)
  })

  it.each([
    {
      name: "owner",
      expectedFailureType: "INVALID_SUBMISSIONS",
      fleet: { ownerPlayerId: branded<PlayerId>("00000000-0000-4000-8000-000000000002") },
      resources: {},
      strength: 20,
      influence: 6,
    },
    {
      name: "malformed transit",
      expectedFailureType: "FAILED_TO_RESOLVE_PHASES",
      fleet: { destinationPlanetId: branded<PlanetId>("destination") },
      resources: {},
      strength: 20,
      influence: 6,
    },
    { name: "strength", expectedFailureType: "INVALID_SUBMISSIONS", fleet: { strength: 19 }, resources: {}, strength: 19, influence: 6 },
    { name: "resources", expectedFailureType: "INVALID_SUBMISSIONS", fleet: {}, resources: { INFLUENCE: 2 }, strength: 20, influence: 2 },
  ])("should revalidate a previously valid selection after fresh $name changes", (change) => {
    // Arrange
    const fixture = createFleetEligibilityScenario({ strength: 20 })
    const action = fixture.order("X", 20)
    const player = fixture.state.players[fixture.playerId]
    Assert.isDefined(player)
    const state = {
      ...fixture.state,
      fleets: { [fixture.source.id]: { ...fixture.source, ...change.fleet } },
      players: { [fixture.playerId]: { ...player, resources: { ...player.resources, ...change.resources } } },
    }
    // Act
    const evaluation = evaluateActionSelection({ state, ruleset: fixture.ruleset, action, selection: action, mode: "complete" })
    const resolution = resolveTurn({ ...state, submittedActions: [action] }, fixture.ruleset, createSeededRng())
    // Assert
    expect(
      evaluateActionSelection({ state: fixture.state, ruleset: fixture.ruleset, action, selection: action, mode: "complete" }).eligible,
    ).toBe(true)
    expect(evaluation.eligible).toBe(false)
    expect(resolution).toStrictEqual(Result.Failure(expect.objectContaining({ type: change.expectedFailureType })))
    expect(state.fleets[fixture.source.id]?.strength).toBe(change.strength)
    expect(state.players[fixture.playerId]?.resources.INFLUENCE).toBe(change.influence)
  })

  it("should reload the entire paid state and replay automatic 2/2/1 continuation without another split or payment", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const input = { ...fixture.state, submittedActions: [fixture.order("X", 20)] }
    // Act
    const first = extractSuccess(resolveTurn(structuredClone(input), fixture.ruleset, createSeededRng()))
    const replay = extractSuccess(resolveTurn(structuredClone(input), fixture.ruleset, createSeededRng()))
    const reloaded = {
      ...first,
      fleets: Object.fromEntries(
        Object.values(first.fleets).map((fleet) => {
          const saved = FleetSchema.parse(JSON.parse(JSON.stringify(fleet)))
          return [saved.id, saved]
        }),
      ),
      players: structuredClone(first.players),
    }
    const second = extractSuccess(
      resolveTurn({ ...reloaded, turn: 2, submittedActions: [] }, createFleetEligibilityScenario({ speed: 1 }).ruleset, createSeededRng()),
    )
    const third = extractSuccess(
      resolveTurn({ ...structuredClone(second), turn: 3, submittedActions: [] }, fixture.ruleset, createSeededRng()),
    )
    // Assert
    expect(replay).toStrictEqual(first)
    expect(Object.values(first.fleets).map((fleet) => [fleet.strength, fleet.distanceToEnd])).toStrictEqual([
      [30, undefined],
      [20, 3],
    ])
    expect(Object.values(second.fleets).map((fleet) => [fleet.strength, fleet.distanceToEnd])).toStrictEqual([
      [30, undefined],
      [20, 1],
    ])
    expect(Object.values(third.fleets).map((fleet) => [fleet.strength, fleet.distanceToEnd])).toStrictEqual([
      [30, undefined],
      [20, undefined],
    ])
    expect(first.players[fixture.playerId]?.resources).toMatchObject({ INFLUENCE: 3, FUEL: 1 })
    expect(second.players).toStrictEqual(first.players)
    expect(third.players).toStrictEqual(first.players)
    expect(Object.values(second.fleets).find((fleet) => fleet.movement !== undefined)?.movement).toMatchObject({
      speed: 2,
      initiatingTurn: 1,
      submittedAction: fixture.order("X", 20),
    })
    expect(third.fleets[fixture.source.id]).toMatchObject({ name: "Original", strength: 30, originPlanetId: fixture.origin.id })
  })

  it("should preserve declaration diagnostic order and duplicate Move diagnostics at construction and JSON load", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const declaration = {
      ...fixture.definition,
      targets: { craft: { targetType: "FLEET", constraints: [] }, route: { targetType: "PLANET", constraints: [] } },
      inputs: {
        force: { type: "FLEET_STRENGTH", fleetTargetTag: "absent" },
        spare: { type: "FLEET_STRENGTH", fleetTargetTag: "absent" },
      },
      effects: [fixture.definition.effects[0], fixture.definition.effects[0]],
    }
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    const loaded = RulesetSchema.safeParse(JSON.parse(JSON.stringify({ ...fixture.ruleset, actionDefinitions: { RENAMED: declaration } })))
    // Assert
    expect(constructed.success).toBe(false)
    expect(loaded.success).toBe(false)
    Assert.isDefined(constructed.error)
    Assert.isDefined(loaded.error)
    const messages = [
      "An Action supports at most one FLEET_MOVE",
      "Input force references a missing or non-fleet source",
      "Input spare references a missing or non-fleet source",
      "Unused input spare",
      "Movement strength input must reference its fleet source",
      "Movement source must be owned",
      "Movement source must be stationary",
      "Movement destination must declare a range from its source",
      "Movement strength input must reference its fleet source",
      "Movement source must be owned",
      "Movement source must be stationary",
      "Movement destination must declare a range from its source",
    ]
    expect(constructed.error.issues).toStrictEqual(messages.map((message) => ({ code: "custom", path: [], message })))
    expect(loaded.error.issues).toStrictEqual(
      messages.map((message) => ({ code: "custom", path: ["actionDefinitions", "RENAMED"], message })),
    )
  })

  it.each([
    { name: "empty", constraints: [], messages: ["Movement source must be owned", "Movement source must be stationary"] },
    {
      name: "duplicate stationary",
      constraints: [{ type: "STATIONARY_FLEET" }, { type: "STATIONARY_FLEET" }],
      messages: ["Movement source must be owned"],
    },
    {
      name: "duplicate owned",
      constraints: [
        { type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} },
        { type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} },
      ],
      messages: ["Movement source must be stationary"],
    },
  ])("should preserve ordered source-policy diagnostics for $name constraints", ({ constraints, messages }) => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const declaration = { ...fixture.definition, targets: { ...fixture.definition.targets, craft: { targetType: "FLEET", constraints } } }
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    const loaded = RulesetSchema.safeParse(JSON.parse(JSON.stringify({ ...fixture.ruleset, actionDefinitions: { RENAMED: declaration } })))
    // Assert
    expect(constructed.success).toBe(false)
    expect(loaded.success).toBe(false)
    Assert.isDefined(constructed.error)
    Assert.isDefined(loaded.error)
    expect(constructed.error.issues).toStrictEqual(messages.map((message) => ({ code: "custom", path: [], message })))
    expect(loaded.error.issues).toStrictEqual(
      messages.map((message) => ({ code: "custom", path: ["actionDefinitions", "RENAMED"], message })),
    )
  })

  it("should preserve the full missing-source diagnostic vector at construction and JSON load", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const declaration = { ...fixture.definition, targets: { route: fixture.definition.targets[branded<TargetTag>("route")] } }
    const messages = [
      'Action Definition "Traverse" is missing target slot tagged "craft" required by the "FLEET_MOVE" effect definition',
      "Target route references a missing or non-fleet source",
      "Input force references a missing or non-fleet source",
      "Movement source must be owned",
      "Movement source must be stationary",
    ]
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    const loaded = RulesetSchema.safeParse(JSON.parse(JSON.stringify({ ...fixture.ruleset, actionDefinitions: { RENAMED: declaration } })))
    // Assert
    expect(constructed.success).toBe(false)
    expect(loaded.success).toBe(false)
    Assert.isDefined(constructed.error)
    Assert.isDefined(loaded.error)
    expect(constructed.error.issues).toStrictEqual(messages.map((message) => ({ code: "custom", path: [], message })))
    expect(loaded.error.issues).toStrictEqual(
      messages.map((message) => ({ code: "custom", path: ["actionDefinitions", "RENAMED"], message })),
    )
  })

  it("should accept renamed movement declarations with reversed source policies", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const declaration = {
      ...fixture.definition,
      targets: {
        ...fixture.definition.targets,
        craft: {
          targetType: "FLEET",
          constraints: [{ type: "STATIONARY_FLEET" }, { type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }],
        },
      },
    }
    // Act
    const constructed = ActionDefinitionSchema.safeParse(declaration)
    const loaded = RulesetSchema.safeParse(JSON.parse(JSON.stringify({ ...fixture.ruleset, actionDefinitions: { RENAMED: declaration } })))
    // Assert
    expect(constructed.success).toBe(true)
    expect(loaded.success).toBe(true)
  })

  it("should reject invalid movement declarations at construction and JSON ruleset load", () => {
    // Arrange
    const fixture = createFleetEligibilityScenario()
    const definition = fixture.definition
    const variants = [
      { ...definition, inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "route" } } },
      { ...definition, inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "absent" } } },
      { ...definition, targets: { ...definition.targets, craft: { targetType: "FLEET", constraints: [{ type: "STATIONARY_FLEET" }] } } },
      {
        ...definition,
        targets: {
          ...definition.targets,
          craft: { targetType: "FLEET", constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }] },
        },
      },
      { ...definition, targets: { ...definition.targets, route: { targetType: "PLANET", constraints: [] } } },
      { ...definition, targets: { ...definition.targets, route: { targetType: "PLANET", constraints: [{ type: "STATIONARY_FLEET" }] } } },
      {
        ...definition,
        targets: {
          ...definition.targets,
          craft: { targetType: "FLEET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: 5 }] },
        },
      },
      { ...definition, targets: { ...definition.targets, route: { targetType: "PLANET", constraints: [{ type: "UNKNOWN_CONSTRAINT" }] } } },
      { ...definition, effects: [{ ...definition.effects[0], inputs: { strength: { actionInputTag: "absent" } } }] },
    ]
    // Act
    const constructed = variants.map((value) => ActionDefinitionSchema.safeParse(value).success)
    const loaded = variants.map(
      (value) =>
        RulesetSchema.safeParse(JSON.parse(JSON.stringify({ ...fixture.ruleset, actionDefinitions: { [definition.id]: value } }))).success,
    )
    // Assert
    expect(constructed).toStrictEqual([false, false, false, false, false, false, false, false, false])
    expect(loaded).toStrictEqual([false, false, false, false, false, false, false, false, false])
  })
})
