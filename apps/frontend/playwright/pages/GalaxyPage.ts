import { Assert, branded, type Branded } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"
import type { LocatorIndex } from "./LocatorIndex.ts"

type RegionLocator = Branded<"GalaxyRegionLocator", Locator>
type StarLocator = Branded<"GalaxyStarLocator", Locator>
type StarSystemStarLocator = Branded<"StarSystemStarLocator", Locator>
type PlanetLocator = Branded<"GalaxyPlanetLocator", Locator>
type FleetMarkerLocator = Branded<"GalaxyFleetMarkerLocator", Locator>

export class GalaxyPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  private readonly regions: Locator
  private readonly stars: Locator
  public readonly starSystemStar: StarSystemStarLocator
  private readonly planets: Locator
  private readonly resetViewButton: Locator

  public readonly heading: Locator
  public readonly map: Locator
  public readonly galaxyFleetMarkers: Locator

  public readonly ownStars: Locator
  public readonly opponentStars: Locator
  /**
   * Stars where the player and its opponents control planets
   */
  public readonly sharedStars: Locator

  public readonly starSystemMap: Locator
  public readonly foregroundBody: Locator
  public readonly foregroundPlanet: PlanetLocator
  public readonly planetDetailsPane: Locator

  public readonly ownedPlanets: Locator
  public readonly unclaimedPlanets: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Galaxy", exact: true })
    this.map = page.getByRole("group", { name: "Galaxy map" })
    this.galaxyFleetMarkers = this.map.locator("[data-fleet-marker]")
    this.regions = page.getByRole("button", { name: /^Center region \d{2}$/ })
    this.stars = page.getByRole("button", { name: /^View .+ Star System/ })

    this.ownStars = this.stars.filter({ has: page.locator('[data-ownership-marker="own"]') })
    this.opponentStars = this.stars.filter({ has: page.locator('[data-ownership-marker="opponent"]') })
    this.sharedStars = this.ownStars.filter({ has: page.locator('[data-ownership-marker="opponent"]') })

    this.starSystemMap = page.getByRole("group", { name: / Star System map$/ })
    this.foregroundBody = this.starSystemMap.locator(':scope > g > g[data-system-body] > [role="button"]').last()
    this.starSystemStar = branded(page.getByRole("button", { name: /^Return to Galaxy from / }))

    this.planets = page.getByRole("button", { name: /^View .+ details/ })
    this.foregroundPlanet = branded(this.foregroundBody.and(this.planets))
    this.ownedPlanets = page.getByRole("button", { name: /^View .+ details, owned by / })
    this.unclaimedPlanets = page.getByRole("button", { name: /^View .+ details$/ })

    this.planetDetailsPane = page.getByRole("complementary", { name: / details$/ })
    this.resetViewButton = page.getByRole("button", { name: "Reset view", exact: true })
  }

  public region(index: LocatorIndex): RegionLocator {
    return branded(index === "last" ? this.regions.last() : this.regions.nth(index))
  }

  public async centerRegion(region: RegionLocator): Promise<void> {
    await region.click()
  }

  public star(index: LocatorIndex): StarLocator {
    return branded(index === "last" ? this.stars.last() : this.stars.nth(index))
  }

  public ownStar(index: LocatorIndex): StarLocator {
    return branded(index === "last" ? this.ownStars.last() : this.ownStars.nth(index))
  }

  public opponentStar(index: LocatorIndex): StarLocator {
    return branded(index === "last" ? this.opponentStars.last() : this.opponentStars.nth(index))
  }

  public async openStarSystem(star: StarLocator): Promise<void> {
    await star.click()
  }

  public planet(name: string): PlanetLocator {
    return branded(this.planets.filter({ has: this.page.locator("title", { hasText: `${name},` }) }))
  }

  public ownedPlanet(index: LocatorIndex): PlanetLocator {
    return branded(index === "last" ? this.ownedPlanets.last() : this.ownedPlanets.nth(index))
  }

  public unclaimedPlanet(index: LocatorIndex): PlanetLocator {
    return branded(index === "last" ? this.unclaimedPlanets.last() : this.unclaimedPlanets.nth(index))
  }

  public async hoverBody(body: PlanetLocator | StarSystemStarLocator): Promise<void> {
    await body.locator(":scope > circle").hover()
  }

  public async leaveBodies(): Promise<void> {
    await this.starSystemMap.hover({ position: { x: 10, y: 10 } })
  }

  public async hoverFleet(marker: FleetMarkerLocator): Promise<void> {
    await this.fleetIcon(marker).hover()
  }

  public async openPlanetProfile(planet: PlanetLocator): Promise<void> {
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

  public async getGalaxyStarDistanceFromCenter(star: StarLocator): Promise<number> {
    return await this.getDistanceFromMapCenter({ map: this.map, target: star })
  }

  public async getGalaxyRegionDistanceFromCenter(region: RegionLocator): Promise<number> {
    return await this.getDistanceFromMapCenter({ map: this.map, target: region })
  }

  public async getStarSystemStarDistanceFromCenter(): Promise<number> {
    return await this.getDistanceFromMapCenter({ map: this.starSystemMap, target: this.starSystemStar.locator("circle").last() })
  }

  public async getPlanetName(planet: PlanetLocator): Promise<string> {
    const label = await planet.getAttribute("aria-label")
    const name = label?.match(/^View (.+) details(?:, owned by .+)?$/)?.[1]
    Assert.isDefined(name)

    return name
  }

  public planetOwnershipLabel(planet: PlanetLocator): Locator {
    return planet.locator(":scope > text")
  }

  public fleetMarkersOnPlanet(planet: PlanetLocator): FleetMarkerLocator {
    return branded(planet.locator("[data-fleet-marker]"))
  }

  public fleetStrength(marker: FleetMarkerLocator): Locator {
    return marker.locator("text")
  }

  public fleetIcon(marker: FleetMarkerLocator): Locator {
    return marker.locator("svg")
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
