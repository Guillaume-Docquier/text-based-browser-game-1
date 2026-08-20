import type { Locator, Page } from "@playwright/test"

export class ActionsPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly actionsLink: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Choose your action" })
    this.actionsLink = page.getByRole("link", { name: "Actions", exact: true })
  }

  public action(name: string): Locator {
    return this.page.getByRole("button", { name: new RegExp(name) })
  }

  public async open(): Promise<void> {
    await this.actionsLink.click()
  }
}
