import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class ShipsPage extends GamePage {
  public readonly address: Locator
  public readonly preview: Locator
  public readonly planned: Locator
  public readonly underway: Locator
  public readonly ship: Locator

  public constructor(page: Page) {
    super(page)
    this.address = page.getByLabel("Destination coordinates")
    this.preview = page.getByRole("region", { name: "Move preview" })
    this.planned = page.getByRole("region", { name: "Planned move" })
    this.underway = page.getByRole("region", { name: "Trip in progress" })
    this.ship = page.getByRole("article", { name: /Transport / })
  }

  public get quoteFacts(): Locator {
    return this.preview.locator("dl")
  }
  public get currentStation(): Locator {
    return this.ship.getByText(/Current station/).locator("..")
  }
  public get travelTime(): Locator {
    return this.preview.getByText("Travel time", { exact: true }).locator("..").getByRole("definition")
  }
  public get turnsRemaining(): Locator {
    return this.underway.getByText("Turns remaining", { exact: true }).locator("..").getByRole("definition")
  }
  public async enterDestination(address: string): Promise<void> {
    await this.address.fill(address)
  }

  public async submit(): Promise<void> {
    await this.preview.getByRole("button", { name: "Submit move" }).click()
  }

  public async cancel(): Promise<void> {
    await this.planned.getByRole("button", { name: "Cancel move" }).click()
  }

  public async reload(): Promise<void> {
    await this.page.reload()
  }
}
