import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class GalaxyPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  public readonly heading: Locator
  public readonly map: Locator
  public readonly regions: Locator
  public readonly stars: Locator
  public readonly starSystemMap: Locator
  public readonly starSystemStar: Locator
  public readonly planets: Locator
  public readonly planetDetailsPane: Locator
  public readonly backToGalaxyButton: Locator
  public readonly resetViewButton: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Galaxy", exact: true })
    this.map = page.getByRole("group", { name: "Galaxy map" })
    this.regions = page.getByRole("button", { name: /^Center region \d{2}$/ })
    this.stars = page.getByRole("button", { name: /^View .+ Star System$/ })
    this.starSystemMap = page.getByRole("group", { name: / Star System map$/ })
    this.starSystemStar = page.getByRole("button", { name: /^Return to Galaxy from / })
    this.planets = page.getByRole("button", { name: /^View .+ details$/ })
    this.planetDetailsPane = page.getByRole("complementary", { name: / details$/ })
    this.backToGalaxyButton = page.getByRole("button", { name: "Galaxy", exact: true })
    this.resetViewButton = page.getByRole("button", { name: "Reset view", exact: true })
  }

  public async zoomGalaxyOut(): Promise<void> {
    await this.map.hover()
    await this.page.mouse.wheel(0, -200)
  }

  public async panStarSystem({ deltaX, deltaY }: { deltaX: number; deltaY: number }): Promise<void> {
    const mapBox = await this.starSystemMap.boundingBox()
    Assert.isDefined(mapBox)
    const start = {
      x: mapBox.x + mapBox.width / 4,
      y: mapBox.y + mapBox.height / 4,
    }

    await this.page.mouse.move(start.x, start.y)
    await this.page.mouse.down()
    await this.page.mouse.move(start.x + deltaX, start.y + deltaY)
    await this.page.mouse.up()
  }

  public async getGalaxyCameraTransform(): Promise<string> {
    const transform = await this.map.locator(":scope > g[transform]").getAttribute("transform")
    Assert.isDefined(transform)

    return transform
  }

  public async getGalaxyCameraScale(): Promise<number> {
    const transform = await this.getGalaxyCameraTransform()
    const scale = /scale\(([^)]+)\)/.exec(transform)?.[1]
    Assert.isDefined(scale)

    return Number(scale)
  }

  public async getGalaxyStarDistanceFromCenter(star: Locator): Promise<number> {
    return await this.getDistanceFromMapCenter({ map: this.map, target: star })
  }

  public async getGalaxyRegionDistanceFromCenter(region: Locator): Promise<number> {
    return await this.getDistanceFromMapCenter({ map: this.map, target: region })
  }

  public async getStarSystemStarDistanceFromCenter(): Promise<number> {
    return await this.getDistanceFromMapCenter({ map: this.starSystemMap, target: this.starSystemStar.locator("circle").last() })
  }

  public async getPlanetName(planet: Locator): Promise<string> {
    const name = await planet.locator("text").textContent()
    Assert.isDefined(name)

    return name
  }

  private async getDistanceFromMapCenter({ map, target }: { map: Locator; target: Locator }): Promise<number> {
    const [mapBox, targetBox] = await Promise.all([map.boundingBox(), target.boundingBox()])
    Assert.isDefined(mapBox)
    Assert.isDefined(targetBox)

    return Math.hypot(
      targetBox.x + targetBox.width / 2 - (mapBox.x + mapBox.width / 2),
      targetBox.y + targetBox.height / 2 - (mapBox.y + mapBox.height / 2),
    )
  }
}
