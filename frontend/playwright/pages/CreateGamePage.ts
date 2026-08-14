import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"

export class CreateGamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/create" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly userMenuButton: Locator
  public readonly gameNameInput: Locator
  public readonly maxPlayersInput: Locator
  public readonly turnLengthInput: Locator
  public readonly turnLengthUnitSelect: Locator
  public readonly generationSeedInput: Locator
  public readonly createButton: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Create a new game" })
    this.userMenuButton = page.getByRole("button", { name: "Open user menu" })
    this.gameNameInput = page.getByRole("textbox", { name: "Game name" })
    this.maxPlayersInput = page.getByRole("spinbutton", { name: "Max number of players" })
    this.turnLengthInput = page.getByRole("spinbutton", { name: "Turn length" })
    this.turnLengthUnitSelect = page.getByRole("combobox", { name: "Turn length unit" })
    this.generationSeedInput = page.getByRole("spinbutton", { name: "Generation seed" })
    this.createButton = page.getByRole("button", { name: "Create", exact: true })
  }

  public static async goto(page: Page): Promise<CreateGamePage> {
    const createGamePage = new CreateGamePage(page)
    await createGamePage.goto()
    return createGamePage
  }

  public async goto(): Promise<void> {
    await this.page.goto(CreateGamePage.urlPattern.pathname)
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

  public async setGenerationSeed(seed: number): Promise<void> {
    await this.generationSeedInput.fill(seed.toString())
  }

  public async submit(): Promise<void> {
    await this.createButton.click()
  }

  public async signOut(): Promise<void> {
    await this.userMenuButton.click()
    await this.page.getByRole("group", { name: "Account actions" }).getByRole("button").last().click()
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
