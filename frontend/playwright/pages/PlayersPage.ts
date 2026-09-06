import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class PlayersPage extends GamePage {
  public readonly readyButton: Locator
  public readonly opponentReady: Locator
  public readonly opponentNotReady: Locator
  public readonly turn: Locator

  public constructor(page: Page) {
    super(page)
    this.readyButton = page.getByRole("button", { name: "Ready", exact: true })
    this.opponentReady = page.getByRole("img", { name: "Ready", exact: true })
    this.opponentNotReady = page.getByRole("img", { name: "Not ready", exact: true })
    this.turn = page.getByRole("banner").getByText("Turn", { exact: true }).locator("..")
  }

  public async toggleReady(): Promise<void> {
    await this.readyButton.click()
  }
}
