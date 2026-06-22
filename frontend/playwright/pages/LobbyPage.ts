import type { Locator, Page } from "@playwright/test"

export class LobbyPage {
  private readonly page: Page
  private readonly gameId: number

  public readonly gameNameHeading: Locator
  public readonly startGameButton: Locator

  public constructor(page: Page, gameId: number, gameName: string) {
    this.page = page
    this.gameId = gameId
    this.gameNameHeading = page.getByRole("heading", { name: gameName })
    this.startGameButton = page.getByRole("button", { name: "Start game" })
  }

  public async goto(): Promise<void> {
    await this.page.goto(`/games/${this.gameId}`)
  }
}
