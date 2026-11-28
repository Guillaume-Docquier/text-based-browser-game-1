import type { Locator, Page } from "@playwright/test"
import { BasePage } from "./BasePage.ts"
import type { GalaxyPage } from "./GalaxyPage.ts"
import type { PlanetsPage } from "./PlanetsPage.ts"
import type { PlayersPage } from "./PlayersPage.ts"

export abstract class GamePage extends BasePage {
  private readonly gameTopBar: Locator
  private readonly galaxyLink: Locator
  private readonly planetsLink: Locator
  private readonly playersLink: Locator

  public readonly credits: Locator
  public readonly gameNameHeading: Locator
  private readonly turnButton: Locator

  protected constructor(page: Page) {
    super(page)

    this.gameTopBar = page.getByRole("banner")
    this.credits = this.gameTopBar.getByLabel("Credits", { exact: true })
    this.gameNameHeading = this.gameTopBar.getByRole("heading", { level: 1 })
    this.turnButton = this.gameTopBar.getByRole("button", { name: /^(Lock in|Cancel lock in)$/ })
    const gameNavigation = page.getByRole("navigation", { name: "Game navigation" })
    this.galaxyLink = gameNavigation.getByRole("link", { name: "Galaxy", exact: true })
    this.planetsLink = gameNavigation.getByRole("link", { name: "Planets", exact: true })
    this.playersLink = gameNavigation.getByRole("link", { name: "Players", exact: true })
  }

  public async toggleLockIn(): Promise<void> {
    await this.turnButton.click()
  }

  public async openGalaxy(): Promise<GalaxyPage> {
    await this.galaxyLink.click()
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Avoid circular dependencies between GamePage and its subclasses.
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }

  public async openPlanets(): Promise<PlanetsPage> {
    await this.planetsLink.click()
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Avoid circular dependencies between GamePage and its subclasses.
    const { PlanetsPage } = await import("./PlanetsPage.ts")
    return new PlanetsPage(this.page)
  }

  public async openPlayers(): Promise<PlayersPage> {
    await this.playersLink.click()
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Avoid circular dependencies between GamePage and its subclasses.
    const { PlayersPage } = await import("./PlayersPage.ts")
    return new PlayersPage(this.page)
  }
}
