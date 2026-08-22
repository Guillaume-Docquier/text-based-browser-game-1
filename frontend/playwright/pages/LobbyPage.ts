import type { Locator, Page } from "@playwright/test"
import { GalaxyPage } from "./GalaxyPage.ts"

export class LobbyPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId" })

  private readonly page: Page

  public readonly gameNameHeading: Locator
  public readonly startGameButton: Locator
  public readonly openGameButton: Locator

  public constructor(page: Page) {
    this.page = page
    this.gameNameHeading = page.getByRole("heading", { level: 1 })
    this.startGameButton = page.getByRole("button", { name: "Start game" })
    this.openGameButton = page.getByRole("button", { name: "Open game" })
  }

  public static async goto(page: Page, gameId: number): Promise<LobbyPage> {
    const lobbyPage = new LobbyPage(page)
    await lobbyPage.goto(gameId)
    return lobbyPage
  }

  public async goto(gameId: number): Promise<void> {
    await this.page.goto(`/games/${gameId}`)
  }

  public configurationValue(label: string): Locator {
    return this.page.getByLabel(label, { exact: true })
  }

  public async startGame(): Promise<void> {
    await this.startGameButton.click()
  }

  public async openGame(): Promise<GalaxyPage> {
    await this.openGameButton.click()
    return new GalaxyPage(this.page)
  }
}
