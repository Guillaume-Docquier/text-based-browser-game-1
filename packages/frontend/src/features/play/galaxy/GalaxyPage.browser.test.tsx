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

describe("Galaxy page", () => {
  it("should preserve Galaxy zoom and the centered star after a Star System round trip", async () => {
    await page.viewport(900, 800)
    await Interactive.run()
    await page.getByRole("button", { name: "Outside map" }).click()
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

  it("should switch planet profiles, dismiss the panel and reopen the system", async () => {
    await page.viewport(1100, 800)
    await Interactive.run()
    const star = page.getByRole("button", { name: "View Sol Star System" })
    const map = page.getByRole("group", { name: "Sol Star System map" })
    await page.mark("Open Terra and read its profile", async () => {
      await star.click()
      await map.getByRole("button", { name: "View Terra details" }).click()
      const panel = page.getByRole("complementary", { name: "Terra details" })
      await expect.element(panel.getByRole("heading", { name: "Terra", exact: true })).toBeVisible()
      await expect.element(panel.getByRole("heading", { name: "Planet attributes" })).toBeVisible()
      await expect.element(panel.getByText("Fertility")).toBeVisible()
      await expect.element(panel.getByText("Max population")).toBeVisible()
      await expect.element(panel.getByText("Coordinates")).toBeVisible()
    })
    await page.mark("Select Mars and dismiss its profile", async () => {
      await map.getByRole("button", { name: "View Mars details" }).click()
      const panel = page.getByRole("complementary", { name: "Mars details" })
      await expect.element(panel.getByRole("heading", { name: "Mars", exact: true })).toBeVisible()
      await map.click({ position: { x: 10, y: 100 } })
      await expect.element(panel).not.toBeInTheDocument()
    })
    await page.mark("Return to the galaxy and revisit Sol", async () => {
      await page.getByRole("button", { name: "Return to Galaxy from Sol" }).click()
      await expect.element(map).not.toBeInTheDocument()
      await star.click()
      await expect.element(map).toBeVisible()
    })
  })
})
