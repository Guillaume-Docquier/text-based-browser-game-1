import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class ActionsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Actions", exact: true })
  }

  public action(name: string, identifyingText?: string, instanceIndex?: number): Locator {
    const actions = this.page
      .getByRole("group", { name: `${name} action`, exact: true })
      .filter(identifyingText === undefined ? {} : { has: this.page.getByText(identifyingText, { exact: true }) })
    return instanceIndex === undefined ? actions : actions.nth(instanceIndex)
  }

  public selectActionButton(name: string, identifyingText?: string, instanceIndex?: number): Locator {
    return this.action(name, identifyingText, instanceIndex).getByRole("button", { name: /^(Select action|Selected|Update action)$/ })
  }

  public async toggleActionSelection(name: string, identifyingText?: string, instanceIndex?: number): Promise<void> {
    const action = this.action(name, identifyingText, instanceIndex)
    const updateButton = action.getByRole("button", { name: "Update action", exact: true })
    if ((await updateButton.count()) > 0) {
      await action.getByRole("button", { name: "Cancel", exact: true }).click()
      return
    }
    await this.selectActionButton(name, identifyingText, instanceIndex).click()
  }

  public targetPicker(actionName: string, identifyingText: string, targetName: string, instanceIndex?: number): Locator {
    return this.action(actionName, identifyingText, instanceIndex).getByRole("combobox", { name: `${targetName} target` })
  }

  public targetChoices(targetName: string): Locator {
    return this.page.getByRole("listbox", { name: `${targetName} target` })
  }

  public async isTargetPickerDisabled(
    actionName: string,
    identifyingText: string,
    targetName: string,
    instanceIndex?: number,
  ): Promise<boolean> {
    return await this.targetPicker(actionName, identifyingText, targetName, instanceIndex).isDisabled()
  }

  public async selectedTargetValue(
    actionName: string,
    identifyingText: string,
    targetName: string,
    instanceIndex?: number,
  ): Promise<string> {
    return (await this.targetPicker(actionName, identifyingText, targetName, instanceIndex).inputValue()).trim()
  }

  public async searchTarget(
    actionName: string,
    identifyingText: string,
    targetName: string,
    { query, instanceIndex }: { query: string; instanceIndex?: number },
  ): Promise<void> {
    await this.targetPicker(actionName, identifyingText, targetName, instanceIndex).fill(query)
  }

  public async chooseFirstTarget(actionName: string, identifyingText: string, targetName: string, instanceIndex?: number): Promise<string> {
    const picker = this.targetPicker(actionName, identifyingText, targetName, instanceIndex)
    if (await picker.isDisabled()) {
      return (await picker.inputValue()).trim()
    }

    await picker.click()
    const option = this.targetChoices(targetName).getByRole("option").first()
    const label = await option.innerText()
    await option.click()
    return label.trim()
  }

  public async enterNumericInput(
    actionName: string,
    identifyingText: string,
    label: string,
    { value, instanceIndex }: { value: number; instanceIndex?: number },
  ): Promise<void> {
    await this.action(actionName, identifyingText, instanceIndex).getByRole("spinbutton", { name: label }).fill(value.toString())
  }

  public async chooseTarget(targetName: string, optionName: string): Promise<void> {
    await this.targetChoices(targetName).getByRole("option", { name: optionName, exact: false }).click()
  }

  public journeySummary(name: string, identifyingText?: string, instanceIndex?: number): Locator {
    return this.action(name, identifyingText, instanceIndex).getByRole("status", { name: "Fleet journey" })
  }

  public cancelActionButton(name: string, identifyingText?: string, instanceIndex?: number): Locator {
    return this.action(name, identifyingText, instanceIndex).getByRole("button", { name: "Cancel", exact: true })
  }

  public actionInput(name: string, identifyingText: string, label: string, instanceIndex?: number): Locator {
    return this.action(name, identifyingText, instanceIndex).getByRole("spinbutton", { name: label })
  }

  public async targetOptionLabels(targetName: string): Promise<string[]> {
    return await this.targetChoices(targetName).getByRole("option").allTextContents()
  }
  public async openTargetPicker(actionName: string, identifyingText: string, targetName: string, instanceIndex?: number): Promise<boolean> {
    const picker = this.targetPicker(actionName, identifyingText, targetName, instanceIndex)
    if (await picker.isDisabled()) {
      return false
    }
    await picker.click()
    return true
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

  public async availableTargetLabels(
    actionName: string,
    identifyingText: string,
    targetName: string,
    { query }: { query?: string } = {},
  ): Promise<string[]> {
    if (await this.isTargetPickerDisabled(actionName, identifyingText, targetName)) {
      return [await this.selectedTargetValue(actionName, identifyingText, targetName)]
    }
    if (!(await this.openTargetPicker(actionName, identifyingText, targetName))) {
      throw new Error("The target picker could not be opened")
    }
    if (query !== undefined) {
      await this.searchTarget(actionName, identifyingText, targetName, { query })
    }
    return await this.targetOptionLabels(targetName)
  }
}
