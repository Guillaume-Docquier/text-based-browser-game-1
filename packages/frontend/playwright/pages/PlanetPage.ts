import type { Locator, Page } from "@playwright/test"
import type { GalaxyPage } from "./GalaxyPage.ts"
import { GamePage } from "./GamePage.ts"

export class PlanetPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/planet/:planetId" })
  public readonly heading: Locator
  private readonly details: Locator

  public constructor(page: Page) {
    super(page)
    this.details = page.getByRole("main").getByRole("article")
    this.heading = this.details.getByRole("heading", { level: 1 })
  }

  public attribute(label: string): Locator {
    return this.details.getByText(label, { exact: true }).locator("..").getByRole("definition")
  }

  public site(name: string): Locator {
    return this.details.getByRole("button", { name, exact: true })
  }

  public siteArtwork(name: string): Locator {
    return this.site(name).locator("image")
  }

  public get ships(): Locator {
    return this.details.getByRole("region", { name: "Ships at this planet" })
  }

  public shipDetail(label: string): Locator {
    return this.details
      .getByRole("region", { name: "Ship details" })
      .getByText(label, { exact: true })
      .locator("..")
      .getByRole("definition")
  }

  public get construction(): Locator {
    return this.details.getByRole("region", { name: "Command center construction" })
  }

  public async chooseTradeCenter(): Promise<void> {
    await this.construction.getByRole("combobox", { name: "Building to construct" }).selectOption("TRADE_CENTER")
  }

  public async submitConstruction(): Promise<void> {
    await this.construction.getByRole("button", { name: "Submit construction" }).click()
  }

  public async cancelConstruction(): Promise<void> {
    await this.construction.getByRole("button", { name: "Cancel construction" }).click()
  }

  public get selectedSite(): Locator {
    return this.details.getByRole("status", { name: "Selected site" })
  }

  public async selectSite(name: string): Promise<void> {
    await this.site(name).click()
  }

  public async reload(): Promise<void> {
    await this.page.reload()
  }

  public async returnToSystem(): Promise<GalaxyPage> {
    await this.details.getByRole("link", { name: /^Return to / }).click()
    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- Avoid a cycle between the planet and galaxy page objects.
    const { GalaxyPage } = await import("./GalaxyPage.ts")
    return new GalaxyPage(this.page)
  }
}
