import type { Locator, Page } from "@playwright/test"

export class GamesBrowserPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly createGameLink: Locator
  public readonly myGamesButton: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Games", level: 1 })
    this.createGameLink = page.getByRole("link", { name: "Create game" })
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
}
