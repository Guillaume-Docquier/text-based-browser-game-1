import { test, expect } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"
import type { ShipsPage } from "../pages/ShipsPage.ts"

test("VIEW-0001 When a player opens a map, list, planet, ship or inspector, its visible information, list membership and sort values follow the same player-specific observation rules as the data returned by the API. An opponent’s private orders remain hidden.", async ({
  alice,
}) => {
  test.setTimeout(90_000)
  const details = await CreateGamePage.createGame({ creator: alice })
  const galaxy = await details.startGame()
  await galaxy.openStarSystem(galaxy.ownStar(0))
  const home = await galaxy.openPlanetProfile(galaxy.ownedPlanet(0))
  const homeAddress = await home.attribute("Coordinates").innerText()
  const targetAddress = "63:50:40"

  const fleet = await test.step("Find an unknown planet by its public address and send the transport", async () => {
    const list = await home.openPlanets()
    await list.showAllPlanets()
    const target = await list.openCoordinate(targetAddress)
    await expect(target.attribute("Observation")).toHaveText("Unknown")
    await expect(target.attribute("Biome")).toHaveText("Unknown")
    return await target.moveHere()
  })
  await settleTrip(fleet)
  await test.step("Read the newly observed surface and its deposit", async () => {
    const list = await fleet.openPlanets()
    await list.showAllPlanets()
    const target = await list.openCoordinate(targetAddress)
    await expect(target.attribute("Observation")).toHaveText("Current vision")
    await expect(target.attribute("Remaining metal deposit")).toHaveText("19")
    await expect(target.site("Center hex, Empty")).toBeVisible()
    const returning = await target.moveSelectedShip()
    await returning.enterDestination(homeAddress)
    await settleTrip(returning)
  })
  await test.step("Consult the saved observation after leaving", async () => {
    const list = await fleet.openPlanets()
    await list.showAllPlanets()
    const target = await list.openCoordinate(targetAddress)
    await target.reload()
    await expect(target.attribute("Observation")).toHaveText(/Last observed · Turn \d+/)
    await expect(target.attribute("Remaining metal deposit")).toHaveText("19")
    await expect(target.site("Center hex, Empty")).toBeVisible()
  })
})

async function settleTrip(fleet: ShipsPage): Promise<void> {
  const turns = parseInt(await fleet.travelTime.innerText(), 10)
  await fleet.submit()
  await expect(fleet.planned).toBeVisible()
  for (let step = 1; step <= turns; step++) {
    await fleet.toggleLockIn()
    if (step < turns) {
      await expect(fleet.turnsRemaining).toHaveText(String(turns - step), { timeout: 30_000 })
    }
  }
  await expect(fleet.address).toBeVisible({ timeout: 30_000 })
}
