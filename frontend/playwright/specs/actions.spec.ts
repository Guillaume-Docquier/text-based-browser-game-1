import { expect, test } from "../fixtures.ts"
import { ActionsPage } from "../pages/ActionsPage.ts"
import { CreateGamePage } from "../pages/CreateGamePage.ts"

test("the actions view shows action costs and updates them when actions are selected", async ({ alice }) => {
  const lobbyPage = await test.step("Create a game", async () => await CreateGamePage.createGame({ creator: alice }))
  const actionsPage = await test.step("Start the game and open Actions", async () => {
    const galaxyPage = await lobbyPage.startGame()
    return await galaxyPage.openActions()
  })

  await expect(alice.page).toHaveURL(ActionsPage.urlPattern)
  await expect(actionsPage.heading).toBeVisible()

  const extractMetal = actionsPage.action("Extract Metal")
  const refineFuel = actionsPage.action("Refine Fuel")
  const generatePower = actionsPage.action("Generate Power")
  const winTheGame = actionsPage.action("Win The Game")

  await test.step("Display Action descriptions", async () => {
    await expect(extractMetal).toContainText("Standard Directive")
    await expect(extractMetal).toContainText("1 Influence")
    await expect(extractMetal).toContainText("Gain 5 Metal.")

    await expect(winTheGame).toContainText("Exceptional Program")
    await expect(winTheGame).toContainText("10 Influence")
    await expect(winTheGame).toContainText("Win the game.")
  })

  await test.step("Display unaffordable costs", async () => {
    await expect(winTheGame).toHaveAttribute("aria-disabled", "true")
    await expect(actionsPage.actionUnaffordableOverlay("Win The Game")).toBeVisible()
    await expect(actionsPage.actionCost("Win The Game", "10 Influence, cannot afford")).toHaveClass(/text-red-400/)
  })

  await test.step("Select multiple affordable actions", async () => {
    await actionsPage.toggleAction("Extract Metal")
    await expect(extractMetal).toHaveAttribute("aria-pressed", "true")
    await expect(refineFuel).toHaveAttribute("aria-disabled", "false")
    await expect(generatePower).toHaveAttribute("aria-disabled", "true")

    await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "2 available of 3 Influence")

    await actionsPage.toggleAction("Refine Fuel")
    await expect(refineFuel).toHaveAttribute("aria-pressed", "true")
    await expect(extractMetal).toHaveAttribute("aria-disabled", "false")
    await expect(refineFuel).toHaveAttribute("aria-disabled", "false")

    await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "0 available of 3 Influence")
    await expect(actionsPage.resource("Metal")).toHaveAttribute("aria-label", "0 available of 2 Metal")
  })

  await test.step("Restores resources when unselecting actions", async () => {
    await actionsPage.toggleAction("Refine Fuel")
    await expect(refineFuel).toHaveAttribute("aria-pressed", "false")
    await expect(extractMetal).toHaveAttribute("aria-pressed", "true")

    await actionsPage.toggleAction("Extract Metal")
    await expect(extractMetal).toHaveAttribute("aria-pressed", "false")

    await expect(actionsPage.resource("Influence")).toHaveAttribute("aria-label", "3 available of 3 Influence")
    await expect(actionsPage.resource("Metal")).toHaveAttribute("aria-label", "2 available of 2 Metal")
    await expect(generatePower).toHaveAttribute("aria-disabled", "false")
  })

  await test.step("Display Action costs in their canonical order", async () => {
    const costLabels = await Promise.all(
      (await actionsPage.actionCosts("Win The Game").all()).map(async (cost) => await cost.getAttribute("aria-label")),
    )

    expect(costLabels).toEqual([
      "10 Influence, cannot afford",
      "5 Metal, cannot afford",
      "5 Energy, cannot afford",
      "5 Fuel, cannot afford",
    ])
  })
})
