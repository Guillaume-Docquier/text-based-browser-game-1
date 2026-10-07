import { composeStory } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import meta, { Interactive } from "./GalaxyMap.stories.tsx"
import { distanceFromMapCenter, starHitArea } from "./mapGeometry.test-support.ts"

const story = composeStory({ ...Interactive, play: undefined }, meta, undefined, "Interactive")

describe("Galaxy map camera", () => {
  it("should center and fit a region, refit after wheel zoom, and reset the view", async () => {
    await page.viewport(900, 800)
    await story.run()
    const map = page.getByRole("group", { name: "Galaxy map" })
    const region = page.getByRole("button", { name: "Center region 99" })
    const initialBox = region.element().getBoundingClientRect()

    await userEvent.click(region)
    await expect.poll(() => distanceFromMapCenter(map.element(), region.element())).toBeLessThan(1)
    await expect.element(map).toHaveAttribute("aria-busy", "false")
    const fittedWidth = region.element().getBoundingClientRect().width
    expect(fittedWidth).toBeGreaterThan(map.element().getBoundingClientRect().width * 0.75)
    expect(fittedWidth).toBeLessThan(map.element().getBoundingClientRect().width)

    await userEvent.wheel(map, { delta: { y: -200 } })
    await expect.poll(() => region.element().getBoundingClientRect().width).toBeGreaterThan(map.element().getBoundingClientRect().width)
    await userEvent.click(region)
    await expect.poll(() => region.element().getBoundingClientRect().width).toBeCloseTo(fittedWidth)
    await expect.poll(() => distanceFromMapCenter(map.element(), region.element())).toBeLessThan(1)
    await expect.element(map).toHaveAttribute("aria-busy", "false")

    await userEvent.click(page.getByRole("button", { name: "Reset view" }))
    await expect.poll(() => region.element().getBoundingClientRect().width).toBeCloseTo(initialBox.width)
    expect(region.element().getBoundingClientRect().x).toBeCloseTo(initialBox.x)
    expect(region.element().getBoundingClientRect().y).toBeCloseTo(initialBox.y)
  })

  it("should center the selected star while preserving wheel zoom through selection", async () => {
    await page.viewport(900, 800)
    await story.run()
    const map = page.getByRole("group", { name: "Galaxy map" })
    const star = page.getByRole("button", { name: "View Sol Star System" })
    const hitArea = starHitArea(star.element())
    const initialWidth = hitArea.getBoundingClientRect().width

    await userEvent.wheel(map, { delta: { y: -200 } })
    await expect.poll(() => hitArea.getBoundingClientRect().width).toBeGreaterThan(initialWidth)
    const zoomedWidth = hitArea.getBoundingClientRect().width
    await userEvent.click(star)
    await expect.element(page.getByRole("status", { name: "Selection" })).toHaveTextContent("Sol")
    await expect.element(map).toHaveAttribute("aria-busy", "false")
    expect(distanceFromMapCenter(map.element(), hitArea)).toBeLessThan(1)
    expect(hitArea.getBoundingClientRect().width).toBeCloseTo(zoomedWidth)
  })
})
