import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class ActionsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Choose your action" })
  }

  public action(name: string): Locator {
    return this.page.getByRole("button", { name: new RegExp(name) })
  }

  public async toggleAction(name: string): Promise<void> {
    await this.action(name).click()
  }

  public actionUnaffordableOverlay(name: string): Locator {
    return this.action(name).locator("[data-unaffordable-overlay]")
  }

  public actionCosts(name: string): Locator {
    return this.action(name).locator('[aria-label="Costs"] > [aria-label]')
  }

  public actionCost(name: string, cost: string): Locator {
    return this.action(name).locator(`[aria-label="Costs"] > [aria-label="${cost}"]`)
  }
}
