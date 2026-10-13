import { expect } from "../fixtures.ts"
import type { ActionsPage } from "../pages/ActionsPage.ts"

/** Checks literal available balances; allocation arithmetic stays at the call site. */
export async function expectAvailableResources(actions: ActionsPage, balances: Readonly<Record<string, number>>): Promise<void> {
  for (const [resource, value] of Object.entries(balances))
    await expect(actions.resource(resource)).toHaveAttribute("aria-label", `${value} available of ${value} ${resource}`)
}
