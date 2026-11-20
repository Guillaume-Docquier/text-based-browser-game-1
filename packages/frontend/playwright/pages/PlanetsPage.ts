import type { Locator, Page } from "@playwright/test"
import type { GalaxyPage } from "./GalaxyPage.ts"
import { GamePage } from "./GamePage.ts"

export class PlanetsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/planets" })
  public readonly heading: Locator
  public readonly table: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Planets", exact: true })
    this.table = page.getByRole("table", { name: "Owned planets" })
  }

  public async openPlanet(name: string): Promise<GalaxyPage> {
    await this.table
      .getByRole("row")
      .filter({ has: this.page.getByRole("cell", { name, exact: true }) })
      .getByRole("link")
      .click()
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Avoid circular dependencies between GamePage and its subclasses.
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }
}
