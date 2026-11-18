import type { Page } from "@playwright/test"
import { ActionsPage } from "./ActionsPage.ts"
import { FleetsPage } from "./FleetsPage.ts"
import { GalaxyPage } from "./GalaxyPage.ts"
import { PlanetsPage } from "./PlanetsPage.ts"
import { PlayersPage } from "./PlayersPage.ts"

export class GamePages {
  public readonly page: Page

  public constructor(page: Page) {
    this.page = page
  }

  public actions(): ActionsPage {
    return new ActionsPage(this)
  }

  public fleets(): FleetsPage {
    return new FleetsPage(this)
  }

  public galaxy(): GalaxyPage {
    return new GalaxyPage(this)
  }

  public planets(): PlanetsPage {
    return new PlanetsPage(this)
  }

  public players(): PlayersPage {
    return new PlayersPage(this)
  }
}
