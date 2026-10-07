import { Assert, branded, type Branded } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"
import type { LocatorIndex } from "./LocatorIndex.ts"

type StarLocator = Branded<"GalaxyStarLocator", Locator>
type StarSystemStarLocator = Branded<"StarSystemStarLocator", Locator>
type PlanetLocator = Branded<"GalaxyPlanetLocator", Locator>
type FleetMarkerLocator = Branded<"GalaxyFleetMarkerLocator", Locator>

export class GalaxyPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

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
}
