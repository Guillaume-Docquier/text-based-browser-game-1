import { Assert, branded, type Branded } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import type { GalaxyPage } from "./GalaxyPage.ts"
import { GamePage } from "./GamePage.ts"
import type { LocatorIndex } from "./LocatorIndex.ts"

type FleetRowLocator = Branded<"FleetRowLocator", Locator>

const FleetColumnIndices = {
  ORIGIN_PLANET: 3,
  DESTINATION_PLANET: 4,
} as const

export class FleetsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/fleets" })

  public readonly heading: Locator
  public readonly table: Locator
  public readonly rows: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Fleets", exact: true })
    this.table = page.getByRole("table", { name: "Fleets" })
    this.rows = this.table.locator("tbody tr").filter({ has: page.getByRole("link") })
  }

  public row(index: LocatorIndex): FleetRowLocator {
    return branded(index === "last" ? this.rows.last() : this.rows.nth(index))
  }

  public originPlanet(row: FleetRowLocator): Locator {
    return row.getByRole("cell").nth(FleetColumnIndices.ORIGIN_PLANET)
  }

  public originPlanetLink(row: FleetRowLocator): Locator {
    return this.originPlanet(row).getByRole("link")
  }

  public destinationPlanetLink(row: FleetRowLocator): Locator {
    return row.getByRole("cell").nth(FleetColumnIndices.DESTINATION_PLANET).getByRole("link")
  }

  public async getOriginPlanet(row: FleetRowLocator): Promise<string> {
    const name = await this.originPlanetLink(row).locator("span").first().textContent()
    Assert.isDefined(name)
    return name
  }

  public async getCoordinate(row: FleetRowLocator): Promise<string> {
    const coordinates = await this.originPlanetLink(row).locator("span").nth(1).textContent()
    Assert.isDefined(coordinates)
    const match = /^\((.+)\)$/.exec(coordinates)
    Assert.isDefined(match)
    const coordinate = match[1]
    Assert.isDefined(coordinate)
    return coordinate
  }

  public async openOriginPlanet(row: FleetRowLocator): Promise<GalaxyPage> {
    await this.originPlanetLink(row).click()
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }

  public async openDestinationPlanet(row: FleetRowLocator): Promise<GalaxyPage> {
    await this.destinationPlanetLink(row).click()
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }
}
