import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

type LocatorIndex = number | "last"

export class GalaxyPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  private readonly regions: Locator
  private readonly stars: Locator
  private readonly starSystemStar: Locator
  private readonly planets: Locator
  private readonly resetViewButton: Locator

  public readonly heading: Locator
  public readonly map: Locator
  public readonly starSystemMap: Locator
  public readonly planetDetailsPane: Locator

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
    this.resetViewButton = page.getByRole("button", { name: "Reset view", exact: true })
  }

  public region(index: LocatorIndex): Locator {
    return index === "last" ? this.regions.last() : this.regions.nth(index)
  }

  public async centerRegion(region: Locator): Promise<void> {
    await region.click()
  }

  public star(index: LocatorIndex): Locator {
    return index === "last" ? this.stars.last() : this.stars.nth(index)
  }

  public async openStarSystem(star: Locator): Promise<void> {
    await star.click()
  }

  public planet(index: LocatorIndex): Locator {
    return index === "last" ? this.planets.last() : this.planets.nth(index)
  }

  public async openPlanetProfile(planet: Locator): Promise<void> {
    await planet.click()
  }

  public async resetView(): Promise<void> {
    await this.resetViewButton.click()
  }

  public async clickOnTheMap(): Promise<void> {
    await this.starSystemMap.click({ position: { x: 10, y: 10 } })
  }

  public async returnToGalaxy(): Promise<void> {
    await this.starSystemStar.click()
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
