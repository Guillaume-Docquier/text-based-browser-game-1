import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { describe, expect, it } from "vitest"
import type { Action, PlayerView } from "#api/types.ts"
import { ControlledConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { FleetActionsScenario } from "#tests/FleetActionsScenario.stub.ts"

function strengths(action: Action): number[] {
  return Object.values(action.selectedInputs ?? {})
}
function stationaryStrength(view: PlayerView): number {
  return view.fleets.find((fleet) => fleet.movement === undefined)?.strength ?? 0
}
function expectRejectedRequests(results: ReadonlyArray<PromiseSettledResult<unknown>>): void {
  const rejected = results.filter((result) => result.status === "rejected")
  for (const result of rejected) expect(result.reason).toMatchObject({ data: { code: "BAD_REQUEST" } })
}

describe("fleet reservations with real PostgreSQL turn locks", () => {
  it.each([
    [30, 30, 1, 30],
    [20, 30, 2, 50],
  ])("should serializes strength requests %s/%s", async (first, second, successes, committed) => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const scenario = await FleetActionsScenario.create({
      player: await api.createClient(),
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const [x = "", y = ""] = await scenario.moveInstances()
    // Act
    const results = await Promise.allSettled([scenario.move(x, first), scenario.move(y, second)])
    const reserved = await scenario.view()
    const processing = await scenario.endTurn()
    const resolved = await scenario.view()
    // Assert
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(successes)
    expectRejectedRequests(results)
    expect(
      reserved.actions
        .filter((action) => action.status === "SUBMITTED")
        .reduce((sum, action) => sum + strengths(action).reduce((a, b) => a + b, 0), 0),
    ).toBe(committed)
    expect(reserved.fleets[0]?.uncommittedStrength).toBe(50 - committed)
    expect(processing).toBe("processed")
    expect(resolved.fleets.reduce((sum, fleet) => sum + fleet.strength, 0)).toBe(50)
    expect(resolved.fleets.every((fleet) => fleet.strength > 0)).toBe(true)
    expect(stationaryStrength(resolved)).toBe(50 - committed)
  })

  it("should cannot race two resource costs against the same uncommitted stockpile", async () => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const scenario = await FleetActionsScenario.create({
      player: await api.createClient(),
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const [x = "", y = ""] = await scenario.moveInstances()
    const view = await scenario.view()
    const origin = view.fleets[0]?.originPlanetId
    Assert.isDefined(origin)
    await scenario.submitDefinition(BuildFleetStandard.id, { planet: origin })
    await scenario.submitDefinition(GainFuel.id)
    await scenario.submitDefinition(GainMetal.id)
    const committed = await scenario.view()
    // Act
    const results = await Promise.allSettled([scenario.move(x, 1), scenario.move(y, 1)])
    const reserved = await scenario.view()
    // Assert
    expect(committed.resources.INFLUENCE.uncommitted).toBe(5)
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(reserved.actions.filter((action) => strengths(action).some((value) => value === 1))).toHaveLength(1)
    expectRejectedRequests(results)
    expect(reserved.resources.INFLUENCE).toStrictEqual({ total: 10, uncommitted: 2 })
    expect(reserved.resources.FUEL.total).toBe(committed.resources.FUEL.total)
  })

  it("should serializes replacement versus cancellation without losing either valid order", async () => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const scenario = await FleetActionsScenario.create({
      player: await api.createClient(),
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const [x = "", y = ""] = await scenario.moveInstances()
    await scenario.move(x, 20)
    await scenario.move(y, 30)
    // Act
    const [replacement, cancellation] = await Promise.allSettled([scenario.move(x, 25), scenario.cancel(y)])
    const view = await scenario.view()
    // Assert
    expect(cancellation.status).toBe("fulfilled")
    expect(view.actions.find((action) => action.id === y)?.status).toBe("AVAILABLE")
    expect(view.actions.find((action) => action.id === x)?.selectedInputs).toStrictEqual({
      strength: { fulfilled: 25, rejected: 20 }[replacement.status],
    })
    expectRejectedRequests([replacement])
    expect(view.fleets[0]?.uncommittedStrength).toBe({ fulfilled: 25, rejected: 30 }[replacement.status])
    expect(view.resources.INFLUENCE).toStrictEqual({ total: 10, uncommitted: 7 })
    expect(view.resources.FUEL.uncommitted).toBe(view.resources.FUEL.total - 1)
  })

  it("should serializes submission against final readiness and deadline promotion", async () => {
    // Arrange
    await using api = await ControlledConcurrencyTestApiServer.create()
    const scenario = await FleetActionsScenario.create({
      player: await api.createClient(),
      clock: api.clock,
      processor: api.processor,
      turnsRepository: api.turnsRepository,
    })
    const [x = "", y = ""] = await scenario.moveInstances()
    const before = await scenario.view()
    // Act
    const [submission, closure] = await Promise.allSettled([
      scenario.move(x, 20),
      scenario.player.client.gameplay.updateReadiness.mutate({ gameId: scenario.gameId, turn: before.turn, isReady: true }),
    ])
    const closed = await scenario.view()
    const processed = await api.processor.processNextDueTurn()
    const next = await scenario.view()
    api.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
    const [afterDeadline, promotion] = await Promise.allSettled([
      scenario.move(y, 1),
      api.turnsRepository.markDueTurnsAwaitingProcessing({ since: api.clock.now() }),
    ])
    // Assert
    expect(closure.status).toBe("fulfilled")
    expect(closed.turnStatus).toBe("AWAITING_PROCESSING")
    expect(closed.actions.find((action) => action.id === x)?.status).toBe(
      { fulfilled: "SUBMITTED", rejected: "AVAILABLE" }[submission.status],
    )
    expect(processed).toBe("processed")
    expect(next.fleets.filter((fleet) => fleet.movement !== undefined)).toHaveLength({ fulfilled: 1, rejected: 0 }[submission.status])
    expectRejectedRequests([submission, afterDeadline])
    expect(afterDeadline.status).toBe("rejected")
    expect(promotion.status).toBe("fulfilled")
  })
})
