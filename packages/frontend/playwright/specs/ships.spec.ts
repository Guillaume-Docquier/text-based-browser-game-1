import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"

test("PV-0006 When a player selects a starting transport, the inspector identifies its owner and current home planet and shows its type, thrust, empty mass, four slots and empty cargo state.", async ({
  alice,
}) => {
  const planet = await test.step("Find the transport at its home planet", async () => {
    const details = await CreateGamePage.createGame({ creator: alice })
    const galaxy = await details.startGame()
    await galaxy.openStarSystem(galaxy.ownStar(0))
    return await galaxy.openPlanetProfile(galaxy.ownedPlanet(0))
  })
  await test.step("Select the ship and inspect its station and capabilities", async () => {
    const transport = planet.ships.getByRole("button", { name: "Transport T-01", exact: true })
    await transport.click()
    await expect(transport).toHaveAttribute("aria-pressed", "true")
    await expect(planet.shipDetail("Owner")).toHaveText(alice.alias)
    const name = await planet.heading.innerText()
    const address = await planet.attribute("Coordinates").innerText()
    await expect(planet.shipDetail("Location")).toHaveText(`${name} · ${address}`)
    await expect(planet.shipDetail("Type")).toHaveText("Transport")
    await expect(planet.shipDetail("Thrust")).toHaveText("64")
    await expect(planet.shipDetail("Empty mass")).toHaveText("4")
    await expect(planet.shipDetail("Cargo capacity")).toHaveText("4 slots")
    await expect(planet.shipDetail("Cargo")).toHaveText("Empty")
  })
  await test.step("Reopen the same named ship after reload", async () => {
    await planet.reload()
    await planet.ships.getByRole("button", { name: "Transport T-01", exact: true }).click()
    await expect(planet.shipDetail("Owner")).toHaveText(alice.alias)
    await expect(planet.shipDetail("Cargo")).toHaveText("Empty")
  })
})
