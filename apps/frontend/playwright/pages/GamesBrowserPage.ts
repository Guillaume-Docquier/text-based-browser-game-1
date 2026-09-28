import type { Locator, Page } from "@playwright/test"
import { CreateGamePage } from "./CreateGamePage.ts"
import { WebsitePage } from "./WebsitePage.ts"

export class GamesBrowserPage extends WebsitePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games" })

  private readonly createGameLink: Locator
  private readonly gameNameFilter: Locator

  public readonly heading: Locator
  public readonly myGamesButton: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Games", level: 1 })
    this.createGameLink = page.getByRole("link", { name: "Create game" })
    this.gameNameFilter = page.getByPlaceholder("Search for games")
    this.myGamesButton = page.getByRole("button", { name: "My games" })
  }

  public static async goto(page: Page): Promise<GamesBrowserPage> {
    return await new GamesBrowserPage(page).goto()
  }

  public async goto(): Promise<GamesBrowserPage> {
    await this.page.goto(GamesBrowserPage.urlPattern.pathname)
    return this
  }

  public game(name: string): Locator {
    return this.page.getByRole("link").filter({ has: this.page.getByText(name, { exact: true }) })
  }

  public async filterToMyGames(): Promise<void> {
    await this.myGamesButton.click()
  }

  public async filterByName(name: string): Promise<void> {
    await this.gameNameFilter.fill(name)
  }

  /**
   * Redirects to CreateGamePage only if the user is signed in.
   */
  public async createGame(): Promise<CreateGamePage> {
    await this.createGameLink.click()
    return new CreateGamePage(this.page)
  }
}
