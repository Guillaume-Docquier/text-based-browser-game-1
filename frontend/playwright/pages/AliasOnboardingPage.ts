import type { Locator, Page } from "@playwright/test"

export class AliasOnboardingPage {
  private readonly page: Page

  public readonly heading: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Choose your alias" })
  }

  public async chooseAlias(alias: string): Promise<void> {
    await this.page.getByRole("textbox", { name: "Alias" }).fill(alias)
    await this.page.getByRole("button", { name: "Continue" }).click()
  }
}
