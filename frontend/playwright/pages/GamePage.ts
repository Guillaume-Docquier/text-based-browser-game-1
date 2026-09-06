import type { Locator, Page } from "@playwright/test"
import type { ActionsPage } from "./ActionsPage.ts"
import type { GalaxyPage } from "./GalaxyPage.ts"
import type { PlayersPage } from "./PlayersPage.ts"

/** Shared game layout and navigation available from every gameplay page. */
export abstract class GamePage {
  protected readonly page: Page

  private readonly gameTopBar: Locator
  private readonly galaxyLink: Locator
  private readonly actionsLink: Locator
  private readonly playersLink: Locator

  public readonly gameNameHeading: Locator
  public readonly resources: Locator
  public readonly turn: Locator
  public readonly turnStatus: Locator

  protected constructor(page: Page) {
    this.page = page

    this.gameTopBar = page.getByRole("banner")
    this.gameNameHeading = this.gameTopBar.getByRole("heading", { level: 1 })
    this.turn = this.gameTopBar.getByText("Turn", { exact: true }).locator("..").getByText(/^\d+$/)
    this.turnStatus = this.gameTopBar.locator('[data-slot="badge"]').first()
    this.resources = this.gameTopBar.locator(
      '[aria-label$="Influence"], [aria-label$="Metal"], [aria-label$="Energy"], [aria-label$="Fuel"], [aria-label$="Colony"]',
    )

    const gameNavigation = page.getByRole("navigation", { name: "Game navigation" })
    this.galaxyLink = gameNavigation.getByRole("link", { name: "Galaxy", exact: true })
    this.actionsLink = gameNavigation.getByRole("link", { name: "Actions", exact: true })
    this.playersLink = gameNavigation.getByRole("link", { name: "Players", exact: true })
  }

  public resource(name: string): Locator {
    return this.gameTopBar.locator(`[aria-label$=" ${name}"]`)
  }

  public resourceDetails(name: string): Locator {
    return this.gameTopBar.getByText(name, { exact: true }).locator("..")
  }

  public async showResourceDetails(): Promise<void> {
    await this.resources.first().hover()
  }

  public async openGalaxy(): Promise<GalaxyPage> {
    await this.galaxyLink.click()
    const { GalaxyPage } = await import("./GalaxyPage.ts") // Avoids circular dependencies issues because GamePage is the base class
    return new GalaxyPage(this.page)
  }

  public async openActions(): Promise<ActionsPage> {
    await this.actionsLink.click()
    const { ActionsPage } = await import("./ActionsPage.ts") // Avoids circular dependencies issues because GamePage is the base class
    return new ActionsPage(this.page)
  }

  public async openPlayers(): Promise<PlayersPage> {
    await this.playersLink.click()
    const { PlayersPage } = await import("./PlayersPage.ts")
    return new PlayersPage(this.page)
  }
}
