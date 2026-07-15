import type { Locator, Page } from "@playwright/test"

export class ActionsPage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  public readonly buildDestination: Locator
  public readonly buildOptions: Locator
  readonly #page: Page

  public constructor(page: Page) {
    this.#page = page
    this.buildDestination = page.getByRole("combobox", { name: "Build destination" })
    this.buildOptions = page.getByRole("option")
  }

  public actionHeading(name: "Make More Money" | "Win The Game" | "Build Unit"): Locator {
    return this.#page.getByRole("heading", { name, exact: true })
  }

  public async openBuildDestination(): Promise<void> {
    await this.buildDestination.click()
  }
}
