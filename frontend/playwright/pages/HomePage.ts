import type { Locator, Page } from "@playwright/test"

export class HomePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly playForFreeLink: Locator
  public readonly createAccountLink: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Build your empire and dominate the galaxy" })
    this.playForFreeLink = page.getByRole("link", { name: "Play for free" })
    this.createAccountLink = page.getByRole("link", { name: "Create account" })
  }

  public static async goto(page: Page): Promise<HomePage> {
    const homePage = new HomePage(page)
    await homePage.goto()
    return homePage
  }

  public async goto(): Promise<void> {
    await this.page.goto(HomePage.urlPattern.pathname)
  }
}
