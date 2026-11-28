import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"

test("SURF-0003 When a planning turn is open, the owner of a planet at turn start can use its existing command center to select a constructible building and an empty surface hex. A command center cannot be selected for construction.", async ({
  alice,
}) => {
  const planet = await test.step("Select the home command center", async () => {
    const details = await CreateGamePage.createGame({ creator: alice })
    const galaxy = await details.startGame()
    await galaxy.openStarSystem(galaxy.ownStar(0))
    const home = await galaxy.openPlanetProfile(galaxy.ownedPlanet(0))
    await home.selectSite("Center hex, Command center")
    await expect(home.construction.getByRole("option", { name: /Command center/ })).toHaveCount(0)
    return home
  })
  await test.step("Preview and submit the chosen type, hex and price", async () => {
    await planet.chooseTradeCenter()
    await planet.selectSite("Hex 3, Empty")
    await expect(planet.construction).toContainText("Trade center on Hex 3 · 30 credits")
    await planet.submitConstruction()
    await expect(planet.construction).toContainText("70 credits available")
    await expect(planet.site("Hex 3, Planned trade center")).toHaveAttribute("aria-pressed", "true")
    await expect(planet.credits).toHaveText("100")
  })
  await test.step("Cancel, restore the budget and plan again", async () => {
    await planet.cancelConstruction()
    await expect(planet.construction).toContainText("100 credits available")
    await expect(planet.site("Hex 3, Empty")).toHaveAttribute("aria-pressed", "true")
    await planet.chooseTradeCenter()
    await planet.submitConstruction()
    await expect(planet.construction).toContainText("30 credits reserved")
  })
  await test.step("Inspect the same completed hex when the turn resolves", async () => {
    await planet.toggleLockIn()
    await expect(planet.credits).toHaveText("80", { timeout: 30_000 })
    await expect(planet.site("Hex 3, Trade center")).toHaveAttribute("aria-pressed", "true")
    await expect(planet.selectedSite).toContainText("10 credits per turn")
    await planet.toggleLockIn()
    await expect(planet.credits).toHaveText("100", { timeout: 30_000 })
  })
})
