import type { Locator, Page } from "@playwright/test"

export class CreateGamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/create" })

  private readonly page: Page

  public readonly heading: Locator
  public readonly userMenuButton: Locator
  public readonly gameNameInput: Locator
  public readonly maxPlayersInput: Locator
  public readonly createButton: Locator

  public constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Create a new game" })
    this.userMenuButton = page.getByRole("button", { name: "Open user menu" })
    this.gameNameInput = page.getByRole("textbox", { name: "Game name" })
    this.maxPlayersInput = page.getByRole("spinbutton", { name: "Max number of players" })
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

  public async submit(): Promise<void> {
    await this.createButton.click()
  }
}
