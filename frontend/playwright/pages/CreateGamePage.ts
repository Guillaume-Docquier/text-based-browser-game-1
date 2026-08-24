import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { LobbyPage } from "./LobbyPage.ts"
import { WebsitePage } from "./WebsitePage.ts"

export class CreateGamePage extends WebsitePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/create" })

  public readonly heading: Locator
  public readonly gameNameInput: Locator
  public readonly maxPlayersInput: Locator
  public readonly turnLengthInput: Locator
  public readonly turnLengthUnitSelect: Locator
  public readonly createButton: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Create a new game" })
    this.gameNameInput = page.getByRole("textbox", { name: "Game name" })
    this.maxPlayersInput = page.getByRole("spinbutton", { name: "Max number of players" })
    this.turnLengthInput = page.getByRole("spinbutton", { name: "Turn length" })
    this.turnLengthUnitSelect = page.getByRole("combobox", { name: "Turn length unit" })
    this.createButton = page.getByRole("button", { name: "Create", exact: true })
  }

  public static async goto(page: Page, options?: { mapGenerationSeed: number }): Promise<CreateGamePage> {
    return await new CreateGamePage(page).goto(options)
  }

  public async goto(options?: { mapGenerationSeed: number }): Promise<CreateGamePage> {
    const seedSearch = options === undefined ? "" : `?mapGenerationSeed=${options.mapGenerationSeed}`
    await this.page.goto(`${CreateGamePage.urlPattern.pathname}${seedSearch}`)
    return this
  }

  public async setGameName(name: string): Promise<void> {
    await this.gameNameInput.fill(name)
  }

  public async setMaxPlayers(maxPlayers: number): Promise<void> {
    await this.maxPlayersInput.fill(maxPlayers.toString())
  }

  public async setTurnLength({ value, unit }: { value: number; unit: "days" | "hours" | "minutes" }): Promise<void> {
    await this.turnLengthInput.fill(value.toString())
    await this.turnLengthUnitSelect.click()
    await this.page.getByRole("option", { name: unit, exact: true }).click()
  }

  public async setRange({ label, min, max }: { label: string; min: number; max: number }): Promise<void> {
    const minimumSlider = this.page.getByRole("slider", { name: `${label} minimum` })
    const maximumSlider = this.page.getByRole("slider", { name: `${label} maximum` })
    const currentMaximum = await this.getSliderValue(maximumSlider)

    if (min > currentMaximum) {
      await this.setSliderValue(maximumSlider, max)
      await this.setSliderValue(minimumSlider, min)
    } else {
      await this.setSliderValue(minimumSlider, min)
      await this.setSliderValue(maximumSlider, max)
    }
  }

  public async submit(): Promise<LobbyPage> {
    await this.createButton.click()
    return new LobbyPage(this.page)
  }

  private async getSliderValue(slider: Locator): Promise<number> {
    const value = await slider.getAttribute("aria-valuenow")
    Assert.isDefined(value)

    return Number(value)
  }

  private async setSliderValue(slider: Locator, target: number): Promise<void> {
    const minimum = Number(await slider.getAttribute("aria-valuemin"))
    const maximum = Number(await slider.getAttribute("aria-valuemax"))

    if (target === minimum) {
      await slider.press("Home")
      return
    }

    if (target === maximum) {
      await slider.press("End")
      return
    }

    for (let attempt = 0; attempt < 200; attempt++) {
      const current = await this.getSliderValue(slider)
      if (current === target) {
        return
      }

      await slider.press(current < target ? "ArrowRight" : "ArrowLeft")
    }

    throw new Error(`Could not set slider to ${target}.`)
  }
}
