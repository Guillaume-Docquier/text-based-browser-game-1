import type { Locator } from "@playwright/test"
import { GamePage } from "./GamePage.ts"
import type { GamePages } from "./GamePages.ts"

export class PlayersPage extends GamePage {
  public readonly readyButton: Locator
  public readonly opponentReady: Locator
  public readonly opponentNotReady: Locator
  public readonly turn: Locator

  public constructor(pages: GamePages) {
    super(pages)
    const { page } = pages
    this.readyButton = page.getByRole("button", { name: "Ready", exact: true })
    this.opponentReady = page.getByRole("img", { name: "Ready", exact: true })
    this.opponentNotReady = page.getByRole("img", { name: "Not ready", exact: true })
    this.turn = page.getByRole("banner").getByText(/^Turn \d+$/, { exact: true })
  }

  public async toggleReady(): Promise<void> {
    await this.readyButton.click()
  }
}
