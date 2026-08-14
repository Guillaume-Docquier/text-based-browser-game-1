import type { Locator, Page } from "@playwright/test"

export class GamesPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly createGameLink: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Games", level: 1 })
    this.createGameLink = page.getByRole("link", { name: "Create game" })
  }

  public static async goto(page: Page): Promise<GamesPage> {
    const gamesPage = new GamesPage(page)
    await gamesPage.goto()
    return gamesPage
  }

  public async goto(): Promise<void> {
    await this.page.goto(GamesPage.urlPattern.pathname)
  }
}
