import type { Locator, Page } from "@playwright/test"
import type { GalaxyPage } from "./GalaxyPage.ts"
import { GamePage } from "./GamePage.ts"

export class PlanetsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/planets" })
  public readonly heading: Locator
  private readonly table: Locator
  public readonly coordinates: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Planets", exact: true })
    this.table = page.getByRole("table", { name: "Owned planets" })
    this.coordinates = this.table.getByRole("link")
  }

  public owner(alias: string): Locator {
    return this.table.getByRole("cell", { name: alias, exact: true })
  }

  public coordinate(name: string): Locator {
    return this.table
      .getByRole("row")
      .filter({ has: this.page.getByRole("cell", { name, exact: true }) })
      .getByRole("link")
  }

  public async openPlanet(name: string): Promise<GalaxyPage> {
    await this.coordinate(name).click()
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Avoid circular dependencies between GamePage and its subclasses.
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }
}
