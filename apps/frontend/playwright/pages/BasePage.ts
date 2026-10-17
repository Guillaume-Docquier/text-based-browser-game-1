import type { Page } from "@playwright/test"

export class BasePage {
  protected page: Page

  public constructor(page: Page) {
    this.page = page
  }

  public async goBack(): Promise<void> {
    await this.page.goBack()
  }
}
