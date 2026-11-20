import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { Button } from "@/components/button.tsx"
import * as stories from "./GalaxyPage.stories.tsx"
import { distanceFromMapCenter, starHitArea } from "./mapGeometry.test-support.ts"

const { Interactive } = composeStories(stories, {
  decorators: [
    (Story): ReactElement => (
      <div>
        <Button>Outside map</Button>
        <Story />
      </div>
    ),
  ],
})

async function renderPage(): Promise<void> {
  await page.viewport(900, 800)
  await Interactive.run()
  await page.getByRole("button", { name: "Outside map" }).click()
}

describe("Galaxy page", () => {
  it("should preserve Galaxy zoom and the centered star after a Star System round trip", async () => {
    await renderPage()
    const map = page.getByRole("group", { name: "Galaxy map" })
    const star = page.getByRole("button", { name: "View Sol Star System" })
    const starWidth = (): number => starHitArea(star.element()).getBoundingClientRect().width
    const initialWidth = starWidth()
    let zoomedWidth = 0

    await page.mark("Zoom the Galaxy and open a Star System", async () => {
      await userEvent.wheel(map, { delta: { y: -200 } })
      await expect.poll(starWidth).toBeGreaterThan(initialWidth)
      zoomedWidth = starWidth()
      await star.click()
      await expect.element(page.getByRole("group", { name: "Sol Star System map" })).toBeVisible()
    })

    await page.mark("Return and wait for the system exit to complete", async () => {
      await page.getByRole("button", { name: "Return to Galaxy from Sol" }).click()
      await expect.element(page.getByRole("heading", { name: "Galaxy", exact: true })).toBeVisible()
      await expect.element(page.getByRole("group", { name: "Sol Star System map" })).not.toBeInTheDocument()
      expect(starWidth()).toBeCloseTo(zoomedWidth)
      expect(distanceFromMapCenter(map.element(), starHitArea(star.element()))).toBeLessThan(1)
    })
  })

  it("should close the Planet profile when the empty Star System map is clicked", async () => {
    await renderPage()
    const map = page.getByRole("group", { name: "Sol Star System map" })
    const profile = page.getByRole("complementary", { name: "Terra details" })

    await page.mark("Open a Planet profile", async () => {
      await page.getByRole("button", { name: "View Sol Star System" }).click()
      await map.getByRole("button", { name: "View Terra details" }).click()
      await expect.element(profile.getByRole("heading", { name: "Terra" })).toBeVisible()
    })

    await page.mark("Click empty space in the Star System", async () => {
      await map.click({ position: { x: 100, y: 100 } })
      await expect.element(profile).not.toBeInTheDocument()
      await expect.element(map).toBeVisible()
    })
  })
})
