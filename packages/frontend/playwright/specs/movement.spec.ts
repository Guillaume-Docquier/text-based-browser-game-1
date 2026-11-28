import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"

test("FLET-0001 When a ship is stationed at a body at turn start, its owner can plan a direct move to any different star or planet, in the same or another system, from either the ship’s Move control and destination coordinates or the destination’s Move here control and ship list.", async ({
  alice,
}) => {
  const game = await CreateGamePage.createGame({ creator: alice })
  const galaxy = await game.startGame()
  await test.step("Choose the star in the home system as the destination", async () => {
    await galaxy.openStarSystem(galaxy.ownStar(0))
    const fleet = await galaxy.moveHere()
    await fleet.submit()
    await expect(fleet.planned).toContainText("1 turn")
    await fleet.cancel()
    await expect(fleet.planned).toHaveCount(0)
    await expect(fleet.ship).toContainText("100 credits available")
  })
  await test.step("Order a move to a different system from the home transport", async () => {
    const map = await galaxy.openGalaxy()
    await map.openStarSystem(map.ownStar(0))
    const planet = await map.openPlanetProfile(map.ownedPlanet(0))
    const fleet = await planet.moveSelectedShip()
    await fleet.enterDestination("63:50")
    await fleet.submit()
    await expect(fleet.planned).toContainText("63:50")
  })
})
test("FLET-0002 When a trip is previewed, the owner can distinguish the ship’s current location from its planned destination and see the same travel distance, departure speed, travel time and full credit cost from either entry point.", async ({
  alice,
}) => {
  const game = await CreateGamePage.createGame({ creator: alice })
  const galaxy = await game.startGame()
  const { address, quote, origin } = await test.step("Read a body-first quote for an unowned planet", async () => {
    await galaxy.openStarSystem(galaxy.ownStar(0))
    const planet = await galaxy.openPlanetProfile(galaxy.unclaimedPlanet(0))
    const address = await planet.attribute("Coordinates").innerText()
    const fleet = await planet.moveHere()
    await expect(fleet.preview).toContainText("4 LY per turn")
    return { address, quote: await fleet.quoteFacts.innerText(), origin: await fleet.currentStation.innerText() }
  })
  await test.step("Read the same quote from the ship", async () => {
    const map = await galaxy.openGalaxy()
    await map.openStarSystem(map.ownStar(0))
    const home = await map.openPlanetProfile(map.ownedPlanet(0))
    const fleet = await home.moveSelectedShip()
    await fleet.enterDestination(address)
    await expect(fleet.ship).toContainText(origin)
    await expect(fleet.quoteFacts).toHaveText(quote, { useInnerText: true })
  })
})
test("FLET-0003 When a ship is underway, its owner can inspect its current position, destination and progress. Its trip cannot be changed or recalled. A ship arriving at the end of N can first act at its destination on N+1 and stays there until ordered.", async ({
  alice,
}) => {
  const game = await CreateGamePage.createGame({ creator: alice })
  const galaxy = await game.startGame()
  await galaxy.openStarSystem(galaxy.ownStar(0))
  const home = await galaxy.openPlanetProfile(galaxy.ownedPlanet(0))
  const fleet = await home.moveSelectedShip()
  await fleet.enterDestination("63:50")
  const duration = parseInt(await fleet.travelTime.innerText(), 10)
  expect(duration).toBeGreaterThan(1)
  await fleet.submit()
  await expect(fleet.planned).toBeVisible()
  await test.step("Leave the origin and inspect the saved trip after reload", async () => {
    await fleet.toggleLockIn()
    await expect(fleet.underway).toBeVisible({ timeout: 30_000 })
    await fleet.reload()
    await expect(fleet.underway).toContainText("Current position")
    await expect(fleet.underway).toContainText("63:50")
    await expect(fleet.address).toHaveCount(0)
    await expect(fleet.planned).toHaveCount(0)
  })
  await test.step("Travel each remaining segment and plan again on arrival", async () => {
    for (let remaining = duration - 1; remaining > 0; remaining--) {
      await expect(fleet.turnsRemaining).toHaveText(String(remaining), { timeout: 30_000 })
      await fleet.toggleLockIn()
    }
    await expect(fleet.address).toBeVisible({ timeout: 30_000 })
    await expect(fleet.ship).toContainText("63:50")
    await fleet.enterDestination("63:50")
    await expect(fleet.ship).toContainText("Choose a different body.")
  })
})
