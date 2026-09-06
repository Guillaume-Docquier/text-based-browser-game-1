import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class FleetsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/fleets" })

  public readonly heading: Locator
  public readonly fleetRows: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Fleets", exact: true })
    this.fleetRows = page.getByRole("table", { name: "Fleets in this game" }).locator("tbody tr")
  }
}
