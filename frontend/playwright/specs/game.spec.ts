import { expect, test } from "../fixtures.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"

test("the game page displays resources in canonical order and shows availability details", async ({ alice }) => {
  const lobbyPage = await test.step("Create a game", async () => await CreateGamePage.createGame({ creator: alice }))
  const galaxyPage = await test.step("Start the game", async () => await lobbyPage.startGame())

  await test.step("Display resources in their canonical order", async () => {
    await expect(galaxyPage.resources).toHaveCount(5)
    const resourceLabels = await Promise.all(
      (await galaxyPage.resources.all()).map(async (resource) => await resource.getAttribute("aria-label")),
    )

    expect(resourceLabels).toEqual([
      "3 available of 3 Influence",
      "2 available of 2 Metal",
      "0 available of 0 Energy",
      "1 available of 1 Fuel",
      "0 available of 0 Colony",
    ])
  })

  await test.step("Display resource availability details on hover", async () => {
    await galaxyPage.showResourceDetails()
    const influenceDetails = galaxyPage.resourceDetails("Influence")
    await expect(influenceDetails).toBeVisible()
    await expect(influenceDetails).toContainText("3 available of 3")
  })
})
