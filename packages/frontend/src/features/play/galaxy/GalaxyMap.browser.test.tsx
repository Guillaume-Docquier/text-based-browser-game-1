import { composeStories } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { distanceFromMapCenter, starHitArea } from "@/testing/mapGeometry.ts"
import * as stories from "./GalaxyMap.stories.tsx"

const { Interactive } = composeStories(stories)

async function renderMap(): Promise<void> {
  await page.viewport(900, 800)
  await Interactive.run()
  await page.getByRole("button", { name: "Reset view" }).click()
}

describe("Galaxy map camera", () => {
  it("should center and fit a region, refit after wheel zoom, and reset the view", async () => {
    await renderMap()
    const map = page.getByRole("group", { name: "Galaxy map" })
    const region = page.getByRole("button", { name: "Center region 99" })
    const initialBox = region.element().getBoundingClientRect()
    let fittedWidth = 0

    await page.mark("Center and fit a region", async () => {
      await region.click()
      await expect.poll(() => distanceFromMapCenter(map.element(), region.element())).toBeLessThan(1)
      await expect.element(map).toHaveAttribute("aria-busy", "false")
      fittedWidth = region.element().getBoundingClientRect().width
      expect(fittedWidth).toBeGreaterThan(map.element().getBoundingClientRect().width * 0.75)
      expect(fittedWidth).toBeLessThan(map.element().getBoundingClientRect().width)
    })

    await page.mark("Wheel zoom and refit the region", async () => {
      await userEvent.wheel(map, { delta: { y: -200 } })
      await expect.poll(() => region.element().getBoundingClientRect().width).toBeGreaterThan(map.element().getBoundingClientRect().width)
      await region.click()
      await expect.poll(() => region.element().getBoundingClientRect().width).toBeCloseTo(fittedWidth)
      await expect.poll(() => distanceFromMapCenter(map.element(), region.element())).toBeLessThan(1)
      await expect.element(map).toHaveAttribute("aria-busy", "false")
    })

    await page.mark("Reset both zoom and position", async () => {
      await page.getByRole("button", { name: "Reset view" }).click()
      await expect.poll(() => region.element().getBoundingClientRect().width).toBeCloseTo(initialBox.width)
      expect(region.element().getBoundingClientRect().x).toBeCloseTo(initialBox.x)
      expect(region.element().getBoundingClientRect().y).toBeCloseTo(initialBox.y)
    })
  })

  it("should center the selected star while preserving wheel zoom", async () => {
    await renderMap()
    const map = page.getByRole("group", { name: "Galaxy map" })
    const star = page.getByRole("button", { name: "View Sol Star System" })
    const hitArea = starHitArea(star.element())
    const initialWidth = hitArea.getBoundingClientRect().width

    await page.mark("Zoom and select a star", async () => {
      await userEvent.wheel(map, { delta: { y: -200 } })
      await expect.poll(() => hitArea.getBoundingClientRect().width).toBeGreaterThan(initialWidth)
      const zoomedWidth = hitArea.getBoundingClientRect().width
      await star.click()
      await expect.element(page.getByRole("status", { name: "Selection" })).toHaveTextContent("Sol")
      await expect.element(map).toHaveAttribute("aria-busy", "false")
      expect(distanceFromMapCenter(map.element(), hitArea)).toBeLessThan(1)
      expect(hitArea.getBoundingClientRect().width).toBeCloseTo(zoomedWidth)
    })
  })
})
