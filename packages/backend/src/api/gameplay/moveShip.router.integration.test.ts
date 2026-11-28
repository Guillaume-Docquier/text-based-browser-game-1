import { Assert } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { readTurnState } from "#testing/readTurnState.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { MoveShipErrorResponses } from "./moveShip.error.ts"

describe("ship movement", () => {
  it("should meet MOVE-0001 When a player submits a move, reserve its full price from available turn-start credits and reserve only that ship’s action. Other ships can receive independent orders.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, submit, home, ship } = await startMatch(server)
    const before = await bob.client.gameplay.getPlayerView.query({ gameId })
    // Act & Assert
    await expect(bob.client.gameplay.moveShip.mutate(submit)).rejects.toMatchErrorResponse(MoveShipErrorResponses.SHIP_UNAVAILABLE)
    await expect(
      alice.client.gameplay.moveShip.mutate({ ...submit, destination: { kind: "planet", id: home.id } }),
    ).rejects.toMatchErrorResponse(MoveShipErrorResponses.DESTINATION_UNAVAILABLE)
    await alice.client.gameplay.moveShip.mutate(submit)
    await expect(alice.client.gameplay.moveShip.mutate(submit)).rejects.toMatchErrorResponse(MoveShipErrorResponses.SHIP_UNAVAILABLE)
    const planned = await alice.client.gameplay.getPlayerView.query({ gameId })
    const order = planned.ships.find((s) => s.id === ship.id)?.order
    Assert.isDefined(order)
    expect(order).toMatchObject({ id: expect.any(String), route: { origin: { id: home.id }, destination: submit.destination, speed: 4 } })
    expect(planned.player.creditBalance).toBe(100)
    expect(Number(planned.availableCredits)).toBeCloseTo(100 - order.route.cost)
    expect(await bob.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(before)
  })

  it("should meet MOVE-0002 When the owner cancels a pending move during open planning, remove its route preview and release the full price and the ship’s action immediately. The ship stays at its origin and can be ordered again in that turn.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, submit, home, ship } = await startMatch(server)
    await alice.client.gameplay.moveShip.mutate(submit)
    const first = await alice.client.gameplay.getPlayerView.query({ gameId })
    const order = first.ships.find((s) => s.id === ship.id)?.order
    Assert.isDefined(order)
    const cancel = { action: "cancel" as const, gameId, turn: 1, orderId: order.id }
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    // Act & Assert
    await expect(bob.client.gameplay.moveShip.mutate(cancel)).rejects.toMatchErrorResponse(MoveShipErrorResponses.ORDER_NOT_FOUND)
    await alice.client.gameplay.moveShip.mutate(cancel)
    const cleared = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(cleared.ships.find((s) => s.id === ship.id)).toMatchObject({ planetId: home.id, trip: null, order: null })
    expect(cleared.availableCredits).toBe("100")
    expect((await readTurnState(alice.client, gameId)).readinessByPlayerId[cleared.player.id]).toBe(true)
    await alice.client.gameplay.moveShip.mutate(submit)
    await expect(alice.client.gameplay.moveShip.mutate(cancel)).rejects.toMatchErrorResponse(MoveShipErrorResponses.ORDER_NOT_FOUND)
    await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    await expect(alice.client.gameplay.moveShip.mutate(cancel)).rejects.toMatchErrorResponse(MoveShipErrorResponses.TURN_NOT_OPEN)
  })

  it("should meet PVR-0007 When another player can see a foreign ship in transit, their player view exposes its current sighting and omits its destination, route and remaining travel. The owner can still inspect the full trip.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const { alice, bob, gameId, submit, ship } = await startMatch(server)
    await alice.client.gameplay.moveShip.mutate(submit)
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })
    // Act
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const owner = (await alice.client.gameplay.getPlayerView.query({ gameId })).ships.find((s) => s.id === ship.id)
    const sighting = (await bob.client.gameplay.getPlayerView.query({ gameId })).ships.find((s) => s.id === ship.id)
    // Assert
    expect(owner).toMatchObject({
      trip: { completedTurns: 1, route: { destination: submit.destination } },
      position: { x: expect.any(Number), y: expect.any(Number) },
    })
    expect(sighting).toStrictEqual({ ...ship, planetId: null, starId: null, trip: null, order: null, position: owner?.position })
    expect(await turnProcessor.processNextDueTurn()).toBe("idle")
    await expect(alice.client.gameplay.moveShip.mutate({ ...submit, turn: 2 })).rejects.toMatchErrorResponse(
      MoveShipErrorResponses.SHIP_UNAVAILABLE,
    )
  })
})

// oxlint-disable-next-line typescript/explicit-function-return-type -- Infer authenticated clients and branded game identifiers from the public API.
async function startMatch(server: ApiServer) {
  const alice = await server.createClient({ authenticated: true })
  const bob = await server.createClient({ authenticated: true })
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const view = await alice.client.gameplay.getPlayerView.query({ gameId })
  const ship = view.ships.find((s) => s.ownerPlayerId === view.player.id)
  Assert.isDefined(ship)
  const home = view.galaxy.systems.flatMap((s) => s.planets).find((p) => p.id === ship.planetId)
  Assert.isDefined(home)
  const star = view.galaxy.systems.map((s) => s.star).find((s) => Math.hypot(s.x - home.x, s.y - home.y) > 4.1)
  Assert.isDefined(star)
  return {
    alice,
    bob,
    gameId,
    home,
    ship,
    submit: { action: "submit" as const, gameId, turn: 1, shipId: ship.id, destination: { kind: "star" as const, id: star.id } },
  }
}
