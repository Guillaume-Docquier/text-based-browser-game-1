import { Assert, type Time, type UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import type { AuthenticatedUser } from "../AuthenticatedUser.ts"
import { DETERMINISTIC_GALAXY_SEED, TEST_RULESET_NAME } from "../constants.ts"
import { LobbyPage } from "./LobbyPage.ts"
import { WebsitePage } from "./WebsitePage.ts"

type TurnLength = Time<UnitOfTime.DAYS | UnitOfTime.HOURS | UnitOfTime.MINUTES>

type CreateGameSettings = {
  readonly gameName?: string
  readonly maxPlayers?: number
  readonly turnLength?: TurnLength
}

type CreateGameInput = {
  readonly creator: AuthenticatedUser
  readonly participants?: readonly AuthenticatedUser[]
  readonly settings?: CreateGameSettings
}

export class CreateGamePage extends WebsitePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/create" })

  private readonly gameNameInput: Locator
  private readonly maxPlayersInput: Locator
  private readonly turnLengthInput: Locator
  private readonly turnLengthUnitSelect: Locator
  private readonly rulesetSelect: Locator

  public readonly heading: Locator
  public readonly createButton: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Create a new game" })
    this.gameNameInput = page.getByRole("textbox", { name: "Game name" })
    this.maxPlayersInput = page.getByRole("spinbutton", { name: "Max number of players" })
    this.turnLengthInput = page.getByRole("spinbutton", { name: "Turn length" })
    this.turnLengthUnitSelect = page.getByRole("combobox", { name: "Turn length unit" })
    this.rulesetSelect = page.getByRole("combobox", { name: "Ruleset" })
    this.createButton = page.getByRole("button", { name: "Create", exact: true })
  }

  public static async goto(page: Page): Promise<CreateGamePage> {
    return await new CreateGamePage(page).goto()
  }

  /**
   * Create a game, join any additional participants, and return the creator's lobby.
   */
  public static async createGame({ creator, participants = [], settings = {} }: CreateGameInput): Promise<LobbyPage> {
    const createGamePage = await CreateGamePage.goto(creator.page)

    await createGamePage.setGameName(settings.gameName ?? `E2E-${crypto.randomUUID()}`)
    await createGamePage.selectRuleset(TEST_RULESET_NAME)

    if (settings.maxPlayers !== undefined) {
      await createGamePage.setMaxPlayers(settings.maxPlayers)
    }

    if (settings.turnLength !== undefined) {
      await createGamePage.setTurnLength(settings.turnLength)
    }

    const creatorLobbyPage = await createGamePage.submit()
    const gameId = await creatorLobbyPage.getGameId()

    for (const participant of participants) {
      const participantLobbyPage = await LobbyPage.goto(participant.page, gameId)
      await participantLobbyPage.joinGame()
    }

    return creatorLobbyPage
  }

  public async goto(): Promise<CreateGamePage> {
    await this.page.goto(`${CreateGamePage.urlPattern.pathname}?mapGenerationSeed=${DETERMINISTIC_GALAXY_SEED}`)
    return this
  }

  public async setGameName(name: string): Promise<void> {
    await this.gameNameInput.fill(name)
  }

  public async setMaxPlayers(maxPlayers: number): Promise<void> {
    await this.maxPlayersInput.fill(maxPlayers.toString())
  }

  public async setTurnLength({ value, unit }: TurnLength): Promise<void> {
    await this.turnLengthInput.fill(value.toString())
    await this.turnLengthUnitSelect.click()
    await this.page.getByRole("option", { name: unit, exact: true }).click()
  }

  public async selectRuleset(name: string): Promise<void> {
    await this.rulesetSelect.click()
    await this.page.getByRole("option", { name, exact: true }).click()
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
