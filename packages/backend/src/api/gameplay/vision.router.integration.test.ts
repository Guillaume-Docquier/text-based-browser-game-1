import { Assert } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { SUN_ID } from "shared/domain/world/Sol.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { advanceTestTurn, flyTo } from "#testing/scoutPlanet.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { PlayerView } from "./PlayerView.ts"

describe("player observations", () => {
  it("should meet PVR-0008 When a participant views a match, every star and planet remains identifiable by its public name, coordinates and location, regardless of scan coverage.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId } = await startPair(server)
    // Act
    const a = await alice.client.gameplay.getPlayerView.query({ gameId })
    const b = await bob.client.gameplay.getPlayerView.query({ gameId })
    // Assert
    expect(publicBodies(a)).toStrictEqual(publicBodies(b))
    expect(a.galaxy.systems.flatMap((s) => s.planets).map((p) => p.observation)).toContain("unknown")
  })

  it("should meet PVR-0009 When a planet is in current vision, the player sees its resolved ownership, biome, size, area, metal production, remaining deposit and buildings. Store those observations for that player.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, aliceHome, bobHome } = await startPair(server)
    const { turnProcessor: worker } = await createTurnProcessorStub({ db })
    const args = { gameId, owner: alice, players: [alice, bob], worker }
    // Act
    await flyTo({ ...args, destination: { kind: "planet", id: bobHome.id } })
    const inRange = await alice.client.gameplay.getPlayerView.query({ gameId })
    await flyTo({ ...args, destination: { kind: "planet", id: aliceHome.id } })
    const away = await alice.client.gameplay.getPlayerView.query({ gameId })
    // Assert
    expect(planet(inRange, bobHome.id)).toMatchObject({ ...bobHome, observedTurn: inRange.turn, observation: "current" })
    expect(planet(away, bobHome.id)).toMatchObject({ ...bobHome, observation: "remembered", observedTurn: inRange.turn })
    expect(inRange.buildings.filter((b) => b.planetId === bobHome.id).map((b) => [b.site, b.type])).toStrictEqual([
      [0, "COMMAND_CENTER"],
      [1, "TRADE_CENTER"],
    ])
    expect(away.buildings.filter((b) => b.planetId === bobHome.id)).toStrictEqual(
      inRange.buildings.filter((b) => b.planetId === bobHome.id),
    )
  })

  it("should meet PVR-0010 When a planet leaves current vision, show that player’s last recorded planet facts and buildings as previously observed. Before any observation those facts are unknown. When current coverage returns, refresh them to the resolved state.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, aliceHome, bobHome } = await startPair(server)
    const { turnProcessor: worker } = await createTurnProcessorStub({ db })
    const args = { gameId, owner: alice, players: [alice, bob], worker }
    const toBob = { kind: "planet" as const, id: bobHome.id }
    const initial = await alice.client.gameplay.getPlayerView.query({ gameId })
    // Act & Assert
    expect(planet(initial, bobHome.id)).toMatchObject({
      observation: "unknown",
      observedTurn: null,
      ownerPlayerId: null,
      biome: null,
      size: null,
      area: null,
      metalProduction: null,
      remainingMetalDeposit: null,
    })
    expect(initial.buildings.filter((b) => b.planetId === bobHome.id)).toStrictEqual([])
    await flyTo({ ...args, destination: toBob })
    const turn = await flyTo({ ...args, destination: { kind: "planet", id: aliceHome.id } })
    await bob.client.gameplay.construction.mutate({ gameId, turn, action: "submit", planetId: bobHome.id, type: "TRADE_CENTER", site: 2 })
    await advanceTestTurn(gameId, turn, args.players, worker)
    const stale = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(planet(stale, bobHome.id)?.observation).toBe("remembered")
    expect(stale.buildings.filter((b) => b.planetId === bobHome.id)).toHaveLength(2)
    await flyTo({ ...args, destination: toBob })
    const refreshed = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(planet(refreshed, bobHome.id)).toMatchObject({ observation: "current", observedTurn: refreshed.turn })
    expect(refreshed.buildings.filter((b) => b.planetId === bobHome.id)).toHaveLength(3)
    expect(refreshed.buildings.filter((b) => b.planetId === bobHome.id).find((b) => b.site === 2)?.type).toBe("TRADE_CENTER")
  })

  it("should meet PVR-0011 When a foreign ship is outside current vision, omit that ship and its cargo from the player’s current data and all player-facing views. Previously seeing it creates no remembered ship or cargo record.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, aliceHome, bobHome } = await startPair(server)
    const { turnProcessor: worker } = await createTurnProcessorStub({ db })
    const args = { gameId, owner: alice, players: [alice, bob], worker }
    // Act
    await flyTo({ ...args, destination: { kind: "planet", id: bobHome.id } })
    const seen = await alice.client.gameplay.getPlayerView.query({ gameId })
    await flyTo({ ...args, destination: { kind: "planet", id: aliceHome.id } })
    const away = await alice.client.gameplay.getPlayerView.query({ gameId })
    // Assert
    expect(seen.ships.find((s) => s.ownerPlayerId === bobHome.ownerPlayerId)).toMatchObject({
      planetId: bobHome.id,
      cargo: [],
      order: null,
    })
    expect(away.ships.filter((s) => s.ownerPlayerId === bobHome.ownerPlayerId)).toStrictEqual([])
    expect(planet(away, bobHome.id)?.observation).toBe("remembered")
  })

  it("should meet PVR-0012 When the Sun or a ship stationed at the Sun is viewed, its current resolved state is public. The Sun’s stockpile becomes public when stockpiles are introduced.", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    using server = new ApiServer(await createApiStub({ db }))
    const { alice, bob, gameId, aliceHome } = await startPair(server)
    const { turnProcessor: worker } = await createTurnProcessorStub({ db })
    // Act
    const turn = await flyTo({ gameId, owner: alice, players: [alice, bob], worker, destination: { kind: "star", id: SUN_ID } })
    const owner = await alice.client.gameplay.getPlayerView.query({ gameId })
    const ship = owner.ships.find((s) => s.ownerPlayerId === owner.player.id)
    Assert.isDefined(ship)
    await alice.client.gameplay.moveShip.mutate({
      gameId,
      turn,
      action: "submit",
      shipId: ship.id,
      destination: { kind: "planet", id: aliceHome.id },
    })
    const observer = await bob.client.gameplay.getPlayerView.query({ gameId })
    // Assert
    expect(observer.ships.find((s) => s.id === ship.id)).toMatchObject({ starId: SUN_ID, cargo: [], order: null, trip: null })
    const sol = observer.galaxy.systems.find((s) => s.star.id === SUN_ID)
    expect(sol?.star.name).toBe("Sun")
    expect(sol?.planets.map((p) => p.observation)).toStrictEqual(Array(8).fill("unknown"))
  })
})
function publicBodies(view: PlayerView): Array<{ id: string; name: string; coordinates: string; x: number; y: number }> {
  return view.galaxy.systems.flatMap(({ star, planets }) =>
    [star, ...planets].map(({ id, name, coordinates, x, y }) => ({ id, name, coordinates, x, y })),
  )
}
function planet(view: PlayerView, id: string): PlayerView["galaxy"]["systems"][number]["planets"][number] | undefined {
  return view.galaxy.systems.flatMap((s) => s.planets).find((p) => p.id === id)
}
// oxlint-disable-next-line typescript/explicit-function-return-type -- Preserve the clients and branded identifiers returned by the API.
async function startPair(server: ApiServer) {
  const alice = await server.createClient({ authenticated: true })
  const bob = await server.createClient({ authenticated: true })
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const [a, b] = await Promise.all([alice, bob].map(async (p) => await p.client.gameplay.getPlayerView.query({ gameId })))
  Assert.isDefined(a)
  Assert.isDefined(b)
  const aliceHome = a.galaxy.systems.flatMap((s) => s.planets).find((p) => p.ownerPlayerId === a.player.id)
  const bobHome = b.galaxy.systems.flatMap((s) => s.planets).find((p) => p.ownerPlayerId === b.player.id)
  Assert.isDefined(aliceHome)
  Assert.isDefined(bobHome)
  return { alice, bob, gameId, aliceHome, bobHome }
}
