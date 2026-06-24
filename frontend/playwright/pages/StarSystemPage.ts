import type { Locator, Page } from "@playwright/test"

export class StarSystemPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/star-system" })

  public readonly summary: Locator

  public constructor(page: Page) {
    this.summary = page.getByText(/^\d+ orbits · \d+ sectors · \d+ bodies$/)
  }
}
