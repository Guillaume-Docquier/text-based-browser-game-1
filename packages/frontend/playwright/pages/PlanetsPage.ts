import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"
import { PlanetPage } from "./PlanetPage.ts"
export class PlanetsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/planets" })

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Planets", exact: true })
  }

  public async showAllPlanets(): Promise<void> {
    await this.page.getByRole("combobox", { name: "Owner" }).click()
    await this.page.getByRole("option", { name: "All planets" }).click()
  }

  public async openCoordinate(coordinate: string): Promise<PlanetPage> {
    await this.page.getByRole("link", { name: coordinate, exact: true }).click()
    return new PlanetPage(this.page)
  }
}
