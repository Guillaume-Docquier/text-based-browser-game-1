import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import type { GalaxyPage } from "./GalaxyPage.ts"
import { GamePage } from "./GamePage.ts"
import type { LocatorIndex } from "./LocatorIndex.ts"

type FleetColumnName = "fleetId" | "ownerName" | "originPlanet" | "coordinates" | "strength"

const FLEET_COLUMN_INDICES = {
  fleetId: 0,
  ownerName: 1,
  originPlanet: 2,
  coordinates: 3,
  strength: 4,
} as const satisfies Record<FleetColumnName, number>

export class FleetsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/fleets" })

  private readonly searchInput: Locator
  private readonly ownerFilter: Locator

  public readonly heading: Locator
  public readonly table: Locator
  public readonly rows: Locator
  public readonly emptyMessage: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Fleets", exact: true })
    this.searchInput = page.getByRole("textbox", { name: "Search fleets" })
    this.ownerFilter = page.getByRole("combobox", { name: "Owner" })
    this.table = page.getByRole("table", { name: "Fleets" })
    this.rows = this.table.locator("tbody tr").filter({ has: page.getByRole("link") })
    this.emptyMessage = this.table.getByRole("cell", { name: /No (matching )?fleets/ })
  }

  public row(index: LocatorIndex): Locator {
    return index === "last" ? this.rows.last() : this.rows.nth(index)
  }

  public fleetId(row: Locator): Locator {
    return row.getByRole("cell").nth(0)
  }

  public originPlanet(row: Locator): Locator {
    return row.getByRole("cell").nth(2)
  }

  public coordinate(row: Locator): Locator {
    return row.getByRole("link")
  }

  public sortHeader(name: string): Locator {
    return this.table.getByRole("columnheader", { exact: true, name })
  }

  public async selectOwner(name: string): Promise<void> {
    await this.ownerFilter.click()
    await this.page.getByRole("option", { name, exact: true }).click()
  }

  public async search(value: string): Promise<void> {
    await this.searchInput.fill(value)
  }

  public async sortBy(column: string): Promise<void> {
    await this.table.getByRole("button", { name: column, exact: true }).click()
  }

  public async getFleetId(row: Locator): Promise<string> {
    const id = await this.fleetId(row).textContent()
    Assert.isDefined(id)
    return id
  }

  public async getOriginPlanet(row: Locator): Promise<string> {
    const name = await this.originPlanet(row).textContent()
    Assert.isDefined(name)
    return name
  }

  public async getCoordinate(row: Locator): Promise<string> {
    const coordinates = await this.coordinate(row).textContent()
    Assert.isDefined(coordinates)
    return coordinates
  }

  public async getColumnValues(columnName: FleetColumnName): Promise<string[]> {
    const columnIndex = FLEET_COLUMN_INDICES[columnName]
    return await this.rows.locator(`td:nth-child(${columnIndex + 1})`).allTextContents()
  }

  public async openCoordinate(row: Locator): Promise<GalaxyPage> {
    await this.coordinate(row).click()
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }
}
