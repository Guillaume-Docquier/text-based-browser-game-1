import type { Locator, Page } from "@playwright/test"

export class OnboardingModal {
  private readonly page: Page

  public readonly heading: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Welcome, commander" })
  }

  public async chooseAlias(alias: string): Promise<void> {
    await this.page.getByRole("textbox", { name: "Choose your alias" }).fill(alias)
  }

  public async finishOnboarding(): Promise<void> {
    await this.page.getByRole("button", { name: "Continue" }).click()
  }
}
