import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"

export class GalaxyPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly map: Locator
  public readonly stars: Locator
  public readonly starSystemMap: Locator
  public readonly starSystemStar: Locator
  public readonly backToGalaxyButton: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Galaxy", exact: true })
    this.map = page.getByRole("group", { name: "Galaxy map" })
    this.stars = page.getByRole("button", { name: /^View .+ Star System$/ })
    this.starSystemMap = page.getByRole("group", { name: / Star System map$/ })
    this.starSystemStar = page.getByRole("button", { name: /^Return to Galaxy from / })
    this.backToGalaxyButton = page.getByRole("button", { name: "Galaxy", exact: true })
  }

  public async zoomGalaxyIn(): Promise<void> {
    await this.map.hover()
    await this.page.mouse.wheel(0, -100)
  }

  public async getGalaxyCameraTransform(): Promise<string> {
    const transform = await this.map.locator(":scope > g[transform]").getAttribute("transform")
    Assert.isDefined(transform)

    return transform
  }
}
