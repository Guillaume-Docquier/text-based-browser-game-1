import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import type { GalaxyPage } from "./GalaxyPage.ts"
import { GamePage } from "./GamePage.ts"
import type { LocatorIndex } from "./LocatorIndex.ts"

type PlanetColumnName = "planetName" | "ownerName" | "coordinates" | "fertility" | "metal" | "fuel" | "energy" | "maxPopulation" | "area"

const PLANET_COLUMN_INDICES = {
  planetName: 0,
  ownerName: 1,
  coordinates: 2,
  fertility: 3,
  metal: 4,
  fuel: 5,
  energy: 6,
  maxPopulation: 7,
  area: 8,
} as const satisfies Record<PlanetColumnName, number>

export class PlanetsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/planets" })

  private readonly searchInput: Locator
  private readonly ownerFilter: Locator

  public readonly heading: Locator
  public readonly table: Locator
  public readonly rows: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Planets", exact: true })
    this.searchInput = page.getByRole("textbox", { name: "Search planets" })
    this.ownerFilter = page.getByRole("combobox", { name: "Owner" })
    this.table = page.getByRole("table", { name: "Owned planets" })
    this.rows = this.table.locator("tbody tr").filter({ has: page.getByRole("link") })
  }

  public row(index: LocatorIndex): Locator {
    return index === "last" ? this.rows.last() : this.rows.nth(index)
  }

  public planetName(row: Locator): Locator {
    return row.getByRole("cell").nth(0)
  }

  public ownerName(row: Locator): Locator {
    return row.getByRole("cell").nth(1)
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

  public async getPlanetName(row: Locator): Promise<string> {
    const name = await this.planetName(row).textContent()
    Assert.isDefined(name)
    return name
  }

  public async getOwnerName(row: Locator): Promise<string> {
    const name = await this.ownerName(row).textContent()
    Assert.isDefined(name)
    return name.trim()
  }

  public async getCoordinate(row: Locator): Promise<string> {
    const coordinates = await this.coordinate(row).textContent()
    Assert.isDefined(coordinates)
    return coordinates
  }

  /**
   * Gets the values in a table column in their displayed row order.
   *
   * @param columnName - The column whose values should be returned.
   */
  public async getColumnValues(columnName: PlanetColumnName): Promise<string[]> {
    const columnIndex = PLANET_COLUMN_INDICES[columnName]
    return await this.rows.locator(`td:nth-child(${columnIndex + 1})`).allTextContents()
  }

  public async openCoordinate(row: Locator): Promise<GalaxyPage> {
    await this.coordinate(row).click()
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }
}
