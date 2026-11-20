import { Assert, branded } from "@guillaume-docquier/tools-ts"
import { composeStories } from "@storybook/react-vite"
import { createGalaxyStub } from "shared/domain/world/Galaxy.stub.ts"
import { GalaxySchema } from "shared/domain/world/Galaxy.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "shared/domain/world/StarSystem.stub.ts"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import * as stories from "./GalaxyMap.stories.tsx"
import { distanceFromMapCenter, starHitArea } from "./mapGeometry.test-support.ts"

const { Interactive } = composeStories(stories)

async function renderMap(): Promise<void> {
  await page.viewport(900, 800)
  await Interactive.run()
  await page.getByRole("button", { name: "Reset view" }).click()
}

describe("Galaxy map ownership", () => {
  it("should show the matching ownership marker only on systems with claimed planets", async () => {
    const currentPlayerId = "00000000-0000-4000-8000-000000000001"
    const opponentPlayerId = "00000000-0000-4000-8000-000000000002"
    const galaxy = GalaxySchema.parse(
      createGalaxyStub({
        systems: [
          createStarSystemStub({
            star: createStarStub({ id: "00000000-0000-4000-8000-000000000003", name: "Vega", x: 25, y: 30 }),
            planets: [createPlanetStub({ id: "00000000-0000-4000-8000-000000000004", ownerPlayerId: currentPlayerId })],
          }),
          createStarSystemStub({
            star: createStarStub({ id: "00000000-0000-4000-8000-000000000005", name: "Sirius", x: 50, y: 30 }),
            planets: [createPlanetStub({ id: "00000000-0000-4000-8000-000000000006", ownerPlayerId: opponentPlayerId })],
          }),
          createStarSystemStub({
            star: createStarStub({ id: "00000000-0000-4000-8000-000000000007", name: "Altair", x: 75, y: 30 }),
            planets: [createPlanetStub({ id: "00000000-0000-4000-8000-000000000008" })],
          }),
        ],
      }),
    )
    await page.viewport(900, 800)
    await Interactive.run({ args: { ...Interactive.args, galaxy, currentPlayerId: branded(currentPlayerId) } })

    await page.mark("Inspect the markers on each Star System", async () => {
      const vega = page.getByRole("button", { name: /^View Vega Star System\b/ }).element()
      const sirius = page.getByRole("button", { name: /^View Sirius Star System\b/ }).element()
      const altair = page.getByRole("button", { name: "View Altair Star System" }).element()
      const ownMarker = vega.querySelector<SVGRectElement>('[data-ownership-marker="own"]')
      const opponentMarker = sirius.querySelector<SVGRectElement>('[data-ownership-marker="opponent"]')

      await expect.element(ownMarker).toBeVisible()
      await expect.element(opponentMarker).toBeVisible()
      Assert.isDefined(ownMarker)
      Assert.isDefined(opponentMarker)
      const ownStroke = getComputedStyle(ownMarker).stroke
      const opponentStroke = getComputedStyle(opponentMarker).stroke
      expect(ownStroke).not.toBe("none")
      expect(opponentStroke).not.toBe("none")
      expect(ownStroke).not.toBe(opponentStroke)

      expect(vega.querySelector('[data-ownership-marker="opponent"]')).toBeNull()
      expect(sirius.querySelector('[data-ownership-marker="own"]')).toBeNull()
      expect(altair.querySelector("[data-ownership-marker]")).toBeNull()
    })
  })
})

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
