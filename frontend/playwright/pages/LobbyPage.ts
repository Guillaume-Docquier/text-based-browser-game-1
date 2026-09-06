import type { Locator, Page } from "@playwright/test"
import { GalaxyPage } from "./GalaxyPage.ts"
import { WebsitePage } from "./WebsitePage.ts"

export class LobbyPage extends WebsitePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId" })

  private readonly startGameButton: Locator
  private readonly joinGameButton: Locator
  private readonly openGameButton: Locator

  public readonly gameNameHeading: Locator

  public constructor(page: Page) {
    super(page)
    this.gameNameHeading = page.getByRole("heading", { level: 1 })
    this.startGameButton = page.getByRole("button", { name: "Start game" })
    this.joinGameButton = page.getByRole("button", { name: "Join game" })
    this.openGameButton = page.getByRole("button", { name: "Open game" })
  }

  public static async goto(page: Page, gameId: number): Promise<LobbyPage> {
    return await new LobbyPage(page).goto(gameId)
  }

  public async goto(gameId: number): Promise<LobbyPage> {
    await this.page.goto(`/games/${gameId}`)
    return this
  }

  public configurationValue(label: string): Locator {
    return this.page.getByLabel(label, { exact: true })
  }

  public async startGame(): Promise<void> {
    await this.startGameButton.click()
  }

  public async joinGame(): Promise<void> {
    await this.joinGameButton.click()
  }

  public async openGame(): Promise<GalaxyPage> {
    await this.openGameButton.click()
    return new GalaxyPage(this.page)
  }
}
