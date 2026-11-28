import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"
import type { LocatorIndex } from "./LocatorIndex.ts"

type StarLocator = Branded<"GalaxyStarLocator", Locator>
type StarSystemStarLocator = Branded<"StarSystemStarLocator", Locator>
type PlanetLocator = Branded<"GalaxyPlanetLocator", Locator>

export class GalaxyPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  private readonly stars: Locator
  public readonly starSystemStar: StarSystemStarLocator
  public readonly systemHeading: Locator

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

    this.ownStars = page.getByRole("button", { name: / Star System with your planets$/ })
    this.opponentStars = page.getByRole("button", { name: / Star System with opponents' planets$/ })
    this.sharedStars = page.getByRole("button", { name: / Star System with your and opponents' planets$/ })

    this.starSystemMap = page.getByRole("group", { name: / Star System map$/ })
    this.starSystemStar = branded(page.getByRole("button", { name: /^Return to Galaxy from / }))

    this.systemHeading = page.getByRole("heading", { name: /^star \d+$/ })
    this.ownedPlanets = page.getByRole("button", { name: /^View .+ details, owned by / })
    this.unclaimedPlanets = page.getByRole("button", { name: /^View .+ details$/ })

    this.planetDetailsPane = page.getByRole("complementary", { name: / details$/ })
  }

  public star(index: LocatorIndex): StarLocator {
    return branded(index === "last" ? this.stars.last() : this.stars.nth(index))
  }

  public starNamed(name: string): StarLocator {
    return branded(this.page.getByRole("button", { name: `View ${name} Star System`, exact: true }))
  }

  public ownStar(index: LocatorIndex): StarLocator {
    return branded(index === "last" ? this.ownStars.last() : this.ownStars.nth(index))
  }

  public opponentSystem(name: string): Locator {
    return this.page.getByRole("button", { name: `View ${name} Star System with opponents' planets`, exact: true })
  }

  public async openStarSystem(star: StarLocator): Promise<void> {
    await star.click()
  }

  public planet(name: string): PlanetLocator {
    return branded(this.page.getByRole("button", { name: `View ${name} details` }))
  }

  public ownedPlanet(index: LocatorIndex): PlanetLocator {
    return branded(index === "last" ? this.ownedPlanets.last() : this.ownedPlanets.nth(index))
  }

  public unclaimedPlanet(index: LocatorIndex): PlanetLocator {
    return branded(index === "last" ? this.unclaimedPlanets.last() : this.unclaimedPlanets.nth(index))
  }

  public async openPlanetProfile(planet: PlanetLocator): Promise<void> {
    await planet.click()
  }

  public async clickOnTheMap(): Promise<void> {
    await this.starSystemMap.click({ position: { x: 10, y: 10 } })
  }

  public async returnToGalaxy(): Promise<void> {
    await this.starSystemStar.click()
  }

  public planetAttribute(label: string): Locator {
    return this.planetDetailsPane.getByText(label, { exact: true }).locator("..").getByRole("definition")
  }

  public planetProfileHeading(name: string): Locator {
    return this.planetDetailsPane.getByRole("heading", { name, exact: true })
  }

  public planetOwnershipLabel(planet: PlanetLocator): Locator {
    return planet.locator(":scope > text")
  }
}
