import type { Locator, Page } from "@playwright/test"

export class SignInPage {
  private readonly page: Page

  public readonly heading: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Welcome back", level: 1 })
  }

  public static async goto(page: Page): Promise<SignInPage> {
    const signInPage = new SignInPage(page)
    await signInPage.goto()
    return signInPage
  }

  public async goto(): Promise<void> {
    await this.page.goto("/sign-in")
  }
}
