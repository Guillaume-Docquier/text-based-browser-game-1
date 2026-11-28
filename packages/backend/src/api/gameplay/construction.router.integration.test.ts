import { Assert } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { readTurnState } from "#testing/readTurnState.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { ConstructionErrorResponses } from "./construction.error.ts"

describe("construction planning", () => {
  it("should meet PVR-0005 When a player submits a valid construction order, only that player sees the building type, exact destination hex and credit cost as a plan, distinguishable from resolved buildings.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, command } = await startMatch(server)
    const before = await bob.client.gameplay.getPlayerView.query({ gameId })

    // Act
    await alice.client.gameplay.construction.mutate(command)
    const mine = await alice.client.gameplay.getPlayerView.query({ gameId })
    const [order] = mine.constructionOrders
    Assert.isDefined(order)

    // Assert
    expect(order).toStrictEqual({ id: expect.any(String), planetId: command.planetId, site: 2, type: "TRADE_CENTER", cost: 30 })
    expect(mine.player.creditBalance).toBe(100)
    expect(mine.buildings).toStrictEqual(before.buildings)
    expect(await bob.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(before)
    await expect(
      bob.client.gameplay.construction.mutate({ gameId, turn: 1, action: "cancel", orderId: order.id }),
    ).rejects.toMatchErrorResponse(ConstructionErrorResponses.ORDER_NOT_FOUND)
  })

  it("should meet CON-0001 When construction is planned, reserve the command center, the selected hex and the full price against the owner’s available turn-start balance. Other pending orders cannot commit those resources again.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, command } = await startMatch(server)
    const submit = alice.client.gameplay.construction.mutate

    // Act & Assert
    await expect(bob.client.gameplay.construction.mutate(command)).rejects.toMatchErrorResponse(
      ConstructionErrorResponses.NO_COMMAND_CENTER,
    )
    for (const site of [0, 1, 999]) {
      await expect(submit({ ...command, site })).rejects.toMatchErrorResponse(ConstructionErrorResponses.SITE_UNAVAILABLE)
    }

    await submit(command)
    const reserved = await alice.client.gameplay.getPlayerView.query({ gameId })
    await expect(submit(command)).rejects.toMatchErrorResponse(ConstructionErrorResponses.CENTER_RESERVED)

    expect(reserved.constructionOrders).toHaveLength(1)
    expect(reserved.player.creditBalance).toBe(100)
    expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(reserved)
  })

  it("should meet CON-0003 When a player cancels their construction order before resolution starts, clear only its preview and release its hex, command center and full price for immediate reuse that turn.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, gameId, command } = await startMatch(server)
    await alice.client.gameplay.construction.mutate(command)
    const [first] = (await alice.client.gameplay.getPlayerView.query({ gameId })).constructionOrders
    Assert.isDefined(first)
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    const cancel = { gameId, turn: 1, action: "cancel" as const, orderId: first.id }

    // Act
    await alice.client.gameplay.construction.mutate(cancel)
    const released = await alice.client.gameplay.getPlayerView.query({ gameId })
    await alice.client.gameplay.construction.mutate(command)

    // Assert
    expect(released.constructionOrders).toStrictEqual([])
    expect(released.player.creditBalance).toBe(100)
    expect((await readTurnState(alice.client, gameId)).readinessByPlayerId[released.player.id]).toBe(true)
    await expect(alice.client.gameplay.construction.mutate(cancel)).rejects.toMatchErrorResponse(ConstructionErrorResponses.ORDER_NOT_FOUND)
    const [replacement] = (await alice.client.gameplay.getPlayerView.query({ gameId })).constructionOrders
    expect(replacement).toMatchObject({ planetId: command.planetId, site: 2, cost: 30 })
    expect(replacement?.id).not.toBe(first.id)
  })

  it("should meet CON-0004 When a player marks or unmarks readiness, follow the existing turn-closing rules. A canceled order has no effect, and an order cannot be changed once resolution has begun.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const { alice, bob, gameId, command } = await startMatch(server)
    await alice.client.gameplay.construction.mutate(command)
    const [order] = (await alice.client.gameplay.getPlayerView.query({ gameId })).constructionOrders
    Assert.isDefined(order)
    const cancel = { gameId, turn: 1, action: "cancel" as const, orderId: order.id }
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: false })
    await alice.client.gameplay.construction.mutate(cancel)

    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    // Act & Assert
    await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    await expect(alice.client.gameplay.construction.mutate(command)).rejects.toMatchErrorResponse(ConstructionErrorResponses.TURN_NOT_OPEN)
    await expect(alice.client.gameplay.construction.mutate(cancel)).rejects.toMatchErrorResponse(ConstructionErrorResponses.TURN_NOT_OPEN)
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const next = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(next.turn).toBe(2)
    expect(next.player.creditBalance).toBe(110)
    expect(next.buildings.filter((building) => building.planetId === command.planetId)).toHaveLength(2)
    await expect(alice.client.gameplay.construction.mutate(command)).rejects.toMatchErrorResponse(ConstructionErrorResponses.TURN_NOT_OPEN)
  })
})

// oxlint-disable-next-line typescript/explicit-function-return-type -- Infer the authenticated API fixtures and branded game identifiers.
async function startMatch(server: ApiServer) {
  const alice = await server.createClient({ authenticated: true })
  const bob = await server.createClient({ authenticated: true })
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const view = await alice.client.gameplay.getPlayerView.query({ gameId })
  const home = view.galaxy.systems.flatMap(({ planets }) => planets).find((planet) => planet.ownerPlayerId === view.player.id)
  Assert.isDefined(home)
  return {
    alice,
    bob,
    gameId,
    command: { action: "submit" as const, gameId, turn: 1, planetId: home.id, type: BuildingType.TRADE_CENTER, site: 2 },
  }
}
