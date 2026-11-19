import type { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import type { AuthenticatedUser } from "../AuthenticatedUser.ts"
import { DETERMINISTIC_GALAXY_SEED } from "../constants.ts"
import { GameDetailsPage } from "./GameDetailsPage.ts"
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

  public readonly heading: Locator
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

  public static async goto(page: Page): Promise<CreateGamePage> {
    return await new CreateGamePage(page).goto()
  }

  public static async createGame({ creator, participants = [], settings = {} }: CreateGameInput): Promise<GameDetailsPage> {
    const createGamePage = await CreateGamePage.goto(creator.page)

    await createGamePage.setGameName(settings.gameName ?? `E2E-${crypto.randomUUID()}`)

    if (settings.maxPlayers !== undefined) {
      await createGamePage.setMaxPlayers(settings.maxPlayers)
    }

    if (settings.turnLength !== undefined) {
      await createGamePage.setTurnLength(settings.turnLength)
    }

    const creatorGameDetailsPage = await createGamePage.submit()
    const gameId = await creatorGameDetailsPage.getGameId()

    for (const participant of participants) {
      const participantGameDetailsPage = await GameDetailsPage.goto(participant.page, gameId)
      await participantGameDetailsPage.joinGame()
    }

    return creatorGameDetailsPage
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

  public async submit(): Promise<GameDetailsPage> {
    await this.createButton.click()
    return new GameDetailsPage(this.page)
  }
}
