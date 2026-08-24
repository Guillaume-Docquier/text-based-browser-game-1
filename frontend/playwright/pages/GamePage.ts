import type { Locator, Page } from "@playwright/test"
import type { ActionsPage } from "./ActionsPage.ts"
import type { GalaxyPage } from "./GalaxyPage.ts"

/** Shared game layout and navigation available from every gameplay page. */
export abstract class GamePage {
  protected readonly page: Page

  private readonly galaxyLink: Locator
  private readonly actionsLink: Locator

  public readonly gameNameHeading: Locator
  public readonly resources: Locator
  public readonly gameTopBar: Locator

  protected constructor(page: Page) {
    this.page = page

    this.gameTopBar = page.getByRole("banner")
    this.gameNameHeading = this.gameTopBar.getByRole("heading", { level: 1 })
    this.resources = this.gameTopBar.locator(
      '[aria-label$="Influence"], [aria-label$="Metal"], [aria-label$="Energy"], [aria-label$="Fuel"], [aria-label$="Colony"]',
    )

    const gameNavigation = page.getByRole("navigation", { name: "Game navigation" })
    this.galaxyLink = gameNavigation.getByRole("link", { name: "Galaxy", exact: true })
    this.actionsLink = gameNavigation.getByRole("link", { name: "Actions", exact: true })
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
}
