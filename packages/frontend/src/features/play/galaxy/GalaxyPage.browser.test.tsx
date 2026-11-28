import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { Button } from "@/components/button.tsx"
import { distanceFromMapCenter, starHitArea } from "@/testing/mapGeometry.ts"
import * as stories from "./GalaxyPage.stories.tsx"

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

describe("Galaxy page camera", () => {
  it("should preserve Galaxy zoom and the centered star after a Star System round trip", async () => {
    await page.viewport(900, 800)
    await Interactive.run()
    await page.getByRole("button", { name: "Outside map" }).click()
    const map = page.getByRole("group", { name: "Galaxy map" })
    const star = page.getByRole("button", { name: "View Rigel Star System" })
    const starWidth = (): number => starHitArea(star.element()).getBoundingClientRect().width
    const initialWidth = starWidth()
    let zoomedWidth = 0

    await page.mark("Zoom the Galaxy and open a Star System", async () => {
      await userEvent.wheel(map, { delta: { y: -200 } })
      await expect.poll(starWidth).toBeGreaterThan(initialWidth)
      zoomedWidth = starWidth()
      await star.click()
      await expect.element(page.getByRole("group", { name: "Rigel Star System map" })).toBeVisible()
    })

    await page.mark("Return and wait for the system exit to complete", async () => {
      await page.getByRole("button", { name: "Return to Galaxy from Rigel" }).click()
      await expect.element(page.getByRole("heading", { name: "Galaxy", exact: true })).toBeVisible()
      await expect.element(page.getByRole("group", { name: "Rigel Star System map" })).not.toBeInTheDocument()
      expect(starWidth()).toBeCloseTo(zoomedWidth)
      expect(distanceFromMapCenter(map.element(), starHitArea(star.element()))).toBeLessThan(1)
    })
  })
})
