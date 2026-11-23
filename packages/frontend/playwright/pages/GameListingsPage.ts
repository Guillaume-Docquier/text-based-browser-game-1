import type { Locator, Page } from "@playwright/test"
import { CreateGamePage } from "./CreateGamePage.ts"
import { WebsitePage } from "./WebsitePage.ts"

export class GameListingsPage extends WebsitePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games" })

  private readonly createGameLink: Locator

  public readonly heading: Locator
  public readonly myGamesButton: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Games", level: 1 })
    this.createGameLink = page.getByRole("link", { name: "Create game" })
    this.myGamesButton = page.getByRole("button", { name: "My games" })
  }

  public static async goto(page: Page): Promise<GameListingsPage> {
    return await new GameListingsPage(page).goto()
  }

  public async goto(): Promise<GameListingsPage> {
    await this.page.goto(GameListingsPage.urlPattern.pathname)
    return this
  }

  public gameListing(name: string): Locator {
    return this.page.getByRole("link").filter({ has: this.page.getByText(name, { exact: true }) })
  }

  public async filterToMyGames(): Promise<void> {
    await this.myGamesButton.click()
  }

  public async createGame(): Promise<CreateGamePage> {
    await this.createGameLink.click()
    return new CreateGamePage(this.page)
  }
}
