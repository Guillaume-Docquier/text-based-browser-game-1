import type { Action, PlayerView } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class ActionsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  private submissionUrl: string | undefined
  private authorization: string | null = null

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Actions", exact: true })
  }

  /** Captures the production router output after a normal page reload, retaining auth only inside this page object. */
  public async refreshPlayerView(): Promise<PlayerView> {
    const pending = this.page.waitForResponse((response) => response.url().includes("gameplay.getPlayerView") && response.ok())
    await this.page.reload()
    const response = await pending
    const url = new URL(response.url())
    this.submissionUrl = `${url.origin}${url.pathname.split("/trpc/")[0]}/trpc/gameplay.updateActionSubmission?batch=1`
    this.authorization = await response.request().headerValue("authorization")
    const body: unknown = await response.json()
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: the successful production getPlayerView router parses its output with PlayerViewDtoSchema; this is its tRPC batch transport envelope.
    const entries = body as Array<{ result?: { data: PlayerView } }>
    const view = entries.map((entry) => entry.result?.data).find((data) => data?.gameId !== undefined && data?.fleets !== undefined)
    Assert.isDefined(view)
    return view
  }

  /** Sends deliberately raw choices to the actual authenticated router, keeping game setup on normal endpoints. */
  public async submitRawSelection(
    view: PlayerView,
    action: Action,
    selectedTargets: Record<string, string> | null,
    selectedInputs: Record<string, unknown> | null,
  ): Promise<{ status: number; body: unknown }> {
    Assert.isDefined(this.submissionUrl)
    const response = await this.page.request.post(this.submissionUrl, {
      headers: { "content-type": "application/json", ...(this.authorization === null ? {} : { authorization: this.authorization }) },
      data: {
        "0": { gameId: view.gameId, turn: view.turn, submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs } },
      },
    })
    return { status: response.status(), body: await response.json() }
  }
  public action(name: string, identifyingText?: string): Locator {
    const action = this.page.getByRole("group", { name: `${name} action`, exact: true })
    return (identifyingText === undefined ? action : action.filter({ has: this.page.getByText(identifyingText, { exact: true }) })).first()
  }

  public selectActionButton(name: string, identifyingText?: string): Locator {
    return this.action(name, identifyingText).getByRole("button", { name: /^(Select action|Selected)$/ })
  }

  public async toggleActionSelection(name: string, identifyingText?: string): Promise<void> {
    await this.selectActionButton(name, identifyingText).click()
  }

  public async updateAction(name: string, identifyingText?: string): Promise<void> {
    await this.action(name, identifyingText).getByRole("button", { name: "Update action", exact: true }).click()
  }
  public updateActionButton(name: string, identifyingText?: string): Locator {
    return this.action(name, identifyingText).getByRole("button", { name: "Update action", exact: true })
  }
  public targetPicker(actionName: string, identifyingText: string, targetName: string): Locator {
    return this.action(actionName, identifyingText).getByRole("combobox", { name: `${targetName} target` })
  }

  public targetChoices(targetName: string): Locator {
    return this.page.getByRole("listbox", { name: `${targetName} target` })
  }

  public async searchTarget(actionName: string, identifyingText: string, targetName: string, query: string): Promise<void> {
    await this.targetPicker(actionName, identifyingText, targetName).fill(query)
  }

  public async getTargetName(targetName: string, optionName: string): Promise<string> {
    const label = await this.targetChoices(targetName).getByRole("option", { name: optionName, exact: false }).innerText()
    return label.replace(/\s*\([^)]+\)$/, "")
  }

  public async chooseTarget(targetName: string, optionName: string): Promise<void> {
    await this.targetChoices(targetName).getByRole("option", { name: optionName, exact: false }).click()
  }

  public async setNumericInput(actionName: string, identifyingText: string, inputName: string, value: string): Promise<void> {
    await this.action(actionName, identifyingText).getByRole("spinbutton", { name: inputName, exact: true }).fill(value)
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
