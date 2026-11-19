import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

type StarLocator = Branded<"GalaxyStarLocator", Locator>
type PlanetLocator = Branded<"GalaxyPlanetLocator", Locator>

export class GalaxyPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/galaxy" })

  public readonly map: Locator
  public readonly ownStars: Locator
  public readonly opponentStars: Locator
  public readonly starSystemMap: Locator

  private readonly returnToGalaxyButton: Locator

  public constructor(page: Page) {
    super(page)
    this.map = page.getByRole("group", { name: "Galaxy map" })
    this.ownStars = this.map.getByRole("button", { name: / Star System with your planets$/ })
    this.opponentStars = this.map.getByRole("button", { name: / Star System with opponents' planets$/ })
    this.starSystemMap = page.getByRole("group", { name: / Star System map$/ })
    this.returnToGalaxyButton = this.starSystemMap.getByRole("button", { name: /^Return to Galaxy from / })
  }

  public star(name: string): StarLocator {
    return branded(this.map.getByRole("button", { name: `View ${name} Star System` }))
  }

  public ownStar(): StarLocator {
    return branded(this.ownStars.first())
  }

  public async openStarSystem(star: StarLocator): Promise<void> {
    await star.click()
  }

  public planet(name: string): PlanetLocator {
    return branded(this.starSystemMap.getByRole("button", { name: `View ${name} details` }))
  }

  public planetDetails(name: string): Locator {
    return this.page.getByRole("complementary", { name: `${name} details`, exact: true })
  }

  public async openPlanetProfile(planet: PlanetLocator): Promise<void> {
    await planet.click()
  }

  public async returnToGalaxy(): Promise<void> {
    await this.returnToGalaxyButton.click()
  }
}
