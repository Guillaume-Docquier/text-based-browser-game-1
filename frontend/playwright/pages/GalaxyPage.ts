import type { Locator, Page } from "@playwright/test"

export class GalaxyPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  public readonly heading: Locator
  public readonly map: Locator
  public readonly stars: Locator
  public readonly starSystemMap: Locator
  public readonly backToGalaxyButton: Locator

  public constructor(page: Page) {
    this.heading = page.getByRole("heading", { name: "Galaxy", exact: true })
    this.map = page.getByRole("group", { name: "Galaxy map" })
    this.stars = page.getByRole("button", { name: /^View .+ Star System$/ })
    this.starSystemMap = page.getByRole("img", { name: / Star System map$/ })
    this.backToGalaxyButton = page.getByRole("button", { name: "Galaxy", exact: true })
  }
}
