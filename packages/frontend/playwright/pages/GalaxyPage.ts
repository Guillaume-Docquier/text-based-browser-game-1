import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"
import type { LocatorIndex } from "./LocatorIndex.ts"

type StarLocator = Branded<"GalaxyStarLocator", Locator>
type PlanetLocator = Branded<"GalaxyPlanetLocator", Locator>

export class GalaxyPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  private readonly stars: Locator

  public readonly heading: Locator
  public readonly map: Locator

  public readonly ownStars: Locator
  public readonly opponentStars: Locator
  public readonly sharedStars: Locator

  public readonly starSystemMap: Locator
  public readonly planetDetailsPane: Locator

  public readonly ownedPlanets: Locator
  public readonly unclaimedPlanets: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Galaxy", exact: true })
    this.map = page.getByRole("group", { name: "Galaxy map" })
    this.stars = page.getByRole("button", { name: /^View .+ Star System/ })

    this.ownStars = this.stars.filter({ has: page.locator('[data-ownership-marker="own"]') })
    this.opponentStars = this.stars.filter({ has: page.locator('[data-ownership-marker="opponent"]') })
    this.sharedStars = this.ownStars.filter({ has: page.locator('[data-ownership-marker="opponent"]') })

    this.starSystemMap = page.getByRole("group", { name: / Star System map$/ })

    this.ownedPlanets = page.getByRole("button", { name: /^View .+ details, owned by / })
    this.unclaimedPlanets = page.getByRole("button", { name: /^View .+ details$/ })

    this.planetDetailsPane = page.getByRole("complementary", { name: / details$/ })
  }

  public ownStar(index: LocatorIndex): StarLocator {
    return branded(index === "last" ? this.ownStars.last() : this.ownStars.nth(index))
  }

  public async openStarSystem(star: StarLocator): Promise<void> {
    await star.click()
  }

  public ownedPlanet(index: LocatorIndex): PlanetLocator {
    return branded(index === "last" ? this.ownedPlanets.last() : this.ownedPlanets.nth(index))
  }

  public unclaimedPlanet(index: LocatorIndex): PlanetLocator {
    return branded(index === "last" ? this.unclaimedPlanets.last() : this.unclaimedPlanets.nth(index))
  }

  public planetOwnershipLabel(planet: PlanetLocator): Locator {
    return planet.locator(":scope > text")
  }
}
