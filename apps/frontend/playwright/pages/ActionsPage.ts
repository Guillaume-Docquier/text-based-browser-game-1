import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class ActionsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Actions", exact: true })
  }

  public action(name: string, identifyingText?: string): Locator {
    const action = this.page.getByRole("group", { name: `${name} action`, exact: true })
    return identifyingText === undefined ? action : action.filter({ has: this.page.getByText(identifyingText, { exact: true }) })
  }

  public selectActionButton(name: string, identifyingText?: string): Locator {
    return this.action(name, identifyingText).getByRole("button", { name: /^(Select action|Selected)$/ })
  }

  public async toggleActionSelection(name: string, identifyingText?: string): Promise<void> {
    await this.selectActionButton(name, identifyingText).click()
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

  public async chooseTarget(targetName: string, optionName: string): Promise<void> {
    await this.targetChoices(targetName).getByRole("option", { name: optionName, exact: false }).click()
  }

  public async chooseFirstTarget(actionName: string, identifyingText: string, targetName: string): Promise<string> {
    await this.targetPicker(actionName, identifyingText, targetName).click()
    const option = this.targetChoices(targetName).getByRole("option").first()
    const label = await option.innerText()
    await option.click()
    return label.replace(/\s*\([^)]+\)$/, "")
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
