import type { Locator, Page } from "@playwright/test"
import { GamePage } from "./GamePage.ts"

export class ActionsPage extends GamePage {
  public static readonly urlPattern = new URLPattern({ pathname: "/games/:gameId/play/actions" })

  public readonly heading: Locator

  public constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Choose your action" })
  }

  public action(name: string): Locator {
    return this.page.getByRole("group", { name, exact: true })
  }

  public target(name: string, targetSlot = "planet"): Locator {
    return this.action(name).getByRole("combobox", { name: `${name} ${targetSlot} target`, exact: true })
  }

  public async selectTarget(name: string, targetSlot = "planet"): Promise<void> {
    await this.target(name, targetSlot).selectOption({ index: 1 })
  }

  public async toggleAction(name: string): Promise<void> {
    const action = this.action(name)
    const deselectButton = action.getByRole("button", { name: "Deselect", exact: true })
    if ((await deselectButton.count()) > 0) {
      await deselectButton.click()
      return
    }

    await action.getByRole("button", { name: "Select action", exact: true }).click()
  }
}
