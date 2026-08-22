import type { Locator, Page } from "@playwright/test"
import type { ActionsPage } from "./ActionsPage.ts"
import type { GalaxyPage } from "./GalaxyPage.ts"

/** Shared game layout and navigation available from every gameplay page. */
export abstract class GamePage {
  protected readonly page: Page

  public readonly gameTopBar: Locator
  public readonly gameNameHeading: Locator
  public readonly resources: Locator
  public readonly gameNavigation: Locator
  public readonly galaxyLink: Locator
  public readonly actionsLink: Locator

  protected constructor(page: Page) {
    this.page = page
    this.gameTopBar = page.getByRole("banner")
    this.gameNameHeading = this.gameTopBar.getByRole("heading", { level: 1 })
    this.resources = this.gameTopBar.locator(
      '[aria-label$="Influence"], [aria-label$="Metal"], [aria-label$="Energy"], [aria-label$="Fuel"], [aria-label$="Colony"]',
    )
    this.gameNavigation = page.getByRole("navigation", { name: "Game navigation" })
    this.galaxyLink = this.gameNavigation.getByRole("link", { name: "Galaxy", exact: true })
    this.actionsLink = this.gameNavigation.getByRole("link", { name: "Actions", exact: true })
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
