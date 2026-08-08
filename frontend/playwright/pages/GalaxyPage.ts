import type { Locator, Page } from "@playwright/test"

export class GalaxyPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  public readonly heading: Locator
  public readonly map: Locator
  public readonly stars: Locator
  public readonly starSystemMap: Locator
  public readonly starSystemStar: Locator
  public readonly backToGalaxyButton: Locator

  public constructor(page: Page) {
    this.heading = page.getByRole("heading", { name: "Galaxy", exact: true })
    this.map = page.getByRole("group", { name: "Galaxy map" })
    this.stars = page.getByRole("button", { name: /^View .+ Star System$/ })
    this.starSystemMap = page.getByRole("group", { name: / Star System map$/ })
    this.starSystemStar = page.getByRole("button", { name: /^Return to Galaxy from / })
    this.backToGalaxyButton = page.getByRole("button", { name: "Galaxy", exact: true })
  }
}
