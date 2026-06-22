import type { Locator, Page } from "@playwright/test"

export class LobbyPage {
  private readonly page: Page

  public readonly gameNameHeading: Locator
  public readonly startGameButton: Locator

  public constructor(page: Page) {
    this.page = page
    this.gameNameHeading = page.getByRole("heading", { level: 1 })
    this.startGameButton = page.getByRole("button", { name: "Start game" })
  }

  public static async goto(page: Page, gameId: number): Promise<LobbyPage> {
    const lobbyPage = new LobbyPage(page)
    await lobbyPage.goto(gameId)
    return lobbyPage
  }

  public async goto(gameId: number): Promise<void> {
    await this.page.goto(`/games/${gameId}`)
  }
}
