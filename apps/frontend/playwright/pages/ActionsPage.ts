import type { PlayerView } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class ActionsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Actions", exact: true })
  }

  /**
   * Reads the production player view after a normal page reload.
   */
  public async refreshPlayerView(): Promise<PlayerView> {
    const pending = this.page
      .waitForResponse((response) => response.url().includes("gameplay.getPlayerView") && response.ok())
      .then(async (response) => {
        const body: unknown = await response.json()
        return body
      })
    await this.page.reload()
    const body = await pending
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: the successful production getPlayerView router parses its output with PlayerViewDtoSchema; this is its tRPC batch transport envelope.
    const entries = body as Array<{ result?: { data: PlayerView } }>
    const view = entries.map((entry) => entry.result?.data).find((data) => data?.gameId !== undefined && data?.fleets !== undefined)
    Assert.isDefined(view)
    return view
  }

  public action(name: string, identifyingText?: string): Locator {
    const action = this.page.getByRole("group", { name: `${name} action`, exact: true })
    return (identifyingText === undefined ? action : action.filter({ has: this.page.getByText(identifyingText, { exact: true }) })).first()
  }

  public selectActionButton(name: string, identifyingText?: string): Locator {
    return this.action(name, identifyingText).getByRole("button", { name: /^(Select action|Selected)$/ })
  }

  public async toggleActionSelection(name: string, identifyingText?: string): Promise<void> {
    const button = this.selectActionButton(name, identifyingText)
    const selected = (await button.getAttribute("aria-pressed")) === "true"
    const saved = this.page.waitForResponse((response) => response.url().includes("gameplay.updateActionSubmission") && response.ok())
    await button.click()
    await saved
    await this.action(name, identifyingText)
      .getByRole("button", { name: /^(Select action|Selected)$/, pressed: !selected })
      .waitFor({ state: "visible" })
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
