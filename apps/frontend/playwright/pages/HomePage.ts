import type { Locator, Page } from "@playwright/test"
import { GamesBrowserPage } from "./GamesBrowserPage.ts"
import { WebsitePage } from "./WebsitePage.ts"

export class HomePage extends WebsitePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/" })

  public readonly heading: Locator
  public readonly playForFreeLink: Locator
  public readonly createAccountLink: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Build your empire and dominate the galaxy" })
    this.playForFreeLink = page.getByRole("link", { name: "Play for free" })
    this.createAccountLink = page.getByRole("link", { name: "Create account" })
  }

  public static async goto(page: Page): Promise<HomePage> {
    return await new HomePage(page).goto()
  }

  public async goto(): Promise<HomePage> {
    await this.page.goto(HomePage.urlPattern.pathname)
    return this
  }

  public async playForFree(): Promise<GamesBrowserPage> {
    await this.playForFreeLink.click()
    return new GamesBrowserPage(this.page)
  }
}
