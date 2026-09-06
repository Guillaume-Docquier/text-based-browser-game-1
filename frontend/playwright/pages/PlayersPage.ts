import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class PlayersPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/players" })

  private readonly readinessButton: Locator
  private readonly opponentRows: Locator
  public readonly heading: Locator
  public readonly playerRows: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Players", exact: true })
    this.playerRows = page.getByRole("listitem")
    this.readinessButton = page.getByRole("button", { name: /Mark yourself/ })
    this.opponentRows = this.playerRows.filter({ hasNot: this.readinessButton })
  }

  public async toggleReadiness(): Promise<void> {
    await this.readinessButton.click()
  }

  public async refresh(): Promise<void> {
    await this.page.reload()
  }

  public get readinessControl(): Locator {
    return this.readinessButton
  }

  public opponentReadyStatus(): Locator {
    return this.opponentRows.getByLabel("Ready", { exact: true })
  }

  public opponentNotReadyStatus(): Locator {
    return this.opponentRows.getByLabel("Not ready", { exact: true })
  }
}
