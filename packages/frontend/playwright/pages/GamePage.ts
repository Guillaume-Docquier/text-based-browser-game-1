import type { Locator } from "@playwright/test"
import type { ActionsPage } from "./ActionsPage.ts"
import { BasePage } from "./BasePage.ts"
import type { FleetsPage } from "./FleetsPage.ts"
import type { GalaxyPage } from "./GalaxyPage.ts"
import type { GamePages } from "./GamePages.ts"
import type { PlanetsPage } from "./PlanetsPage.ts"
import type { PlayersPage } from "./PlayersPage.ts"

/** Shared game layout and navigation available from every gameplay page. */
export abstract class GamePage extends BasePage {
  protected readonly pages: GamePages
  private readonly gameTopBar: Locator
  private readonly galaxyLink: Locator
  private readonly planetsLink: Locator
  private readonly fleetsLink: Locator
  private readonly actionsLink: Locator
  private readonly playersLink: Locator

  public readonly gameNameHeading: Locator
  public readonly resources: Locator
  private readonly turnButton: Locator

  protected constructor(pages: GamePages) {
    super(pages.page)
    this.pages = pages
    const { page } = pages

    this.gameTopBar = page.getByRole("banner")
    this.gameNameHeading = this.gameTopBar.getByRole("heading", { level: 1 })
    this.turnButton = this.gameTopBar.getByRole("button", { name: /^(Lock in|Cancel lock in)$/ })
    this.resources = this.gameTopBar.locator(
      '[aria-label$="Influence"], [aria-label$="Metal"], [aria-label$="Energy"], [aria-label$="Fuel"], [aria-label$="Colony"]',
    )

    const gameNavigation = page.getByRole("navigation", { name: "Game navigation" })
    this.galaxyLink = gameNavigation.getByRole("link", { name: "Galaxy", exact: true })
    this.planetsLink = gameNavigation.getByRole("link", { name: "Planets", exact: true })
    this.fleetsLink = gameNavigation.getByRole("link", { name: "Fleets", exact: true })
    this.actionsLink = gameNavigation.getByRole("link", { name: "Actions", exact: true })
    this.playersLink = gameNavigation.getByRole("link", { name: "Players", exact: true })
  }

  public resource(name: string): Locator {
    return this.gameTopBar.locator(`[aria-label$=" ${name}"]`)
  }

  public async toggleLockIn(): Promise<void> {
    await this.turnButton.click()
  }

  public resourceDetails(name: string): Locator {
    return this.gameTopBar.getByText(name, { exact: true }).locator("..")
  }

  public async showResourceDetails(): Promise<void> {
    await this.resources.first().hover()
  }

  public async openGalaxy(): Promise<GalaxyPage> {
    await this.galaxyLink.click()
    return this.pages.galaxy()
  }

  public async openPlanets(): Promise<PlanetsPage> {
    await this.planetsLink.click()
    return this.pages.planets()
  }

  public async openFleets(): Promise<FleetsPage> {
    await this.fleetsLink.click()
    return this.pages.fleets()
  }

  public async openActions(): Promise<ActionsPage> {
    await this.actionsLink.click()
    return this.pages.actions()
  }

  public async openPlayers(): Promise<PlayersPage> {
    await this.playersLink.click()
    return this.pages.players()
  }
}
