import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class PlayersPage extends GamePage {
  public readonly heading: Locator
  public readonly readyButton: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Players", exact: true })
    this.readyButton = page.getByRole("button", { name: /^Mark yourself (not )?ready$/ })
  }

  public async toggleReady(): Promise<void> {
    await this.readyButton.click()
  }
}
