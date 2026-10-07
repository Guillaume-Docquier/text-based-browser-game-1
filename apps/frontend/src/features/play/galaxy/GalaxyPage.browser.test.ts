import { composeStory } from "@storybook/react-vite"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import meta, { RoundTrip } from "./GalaxyPage.stories.tsx"
import { distanceFromMapCenter, starHitArea } from "./mapGeometry.test-support.ts"

const story = composeStory(RoundTrip, meta, undefined, "RoundTrip")

describe("Galaxy page camera", () => {
  it("should preserve Galaxy zoom and the centered star after a Star System round trip", async () => {
    await page.viewport(900, 800)
    await story.run()
    const map = page.getByRole("group", { name: "Galaxy map" })
    const star = page.getByRole("button", { name: "View Sol Star System" })
    const starWidth = (): number => starHitArea(star.element()).getBoundingClientRect().width
    const initialWidth = starWidth()

    await userEvent.wheel(map, { delta: { y: -200 } })
    await expect.poll(starWidth).toBeGreaterThan(initialWidth)
    const zoomedWidth = starWidth()
    await userEvent.click(star)
    await expect.element(page.getByRole("group", { name: "Sol Star System map" })).toBeVisible()
    await userEvent.click(page.getByRole("button", { name: "Return to Galaxy from Sol" }))
    await expect.element(page.getByRole("heading", { name: "Galaxy", exact: true })).toBeVisible()
    await expect.element(page.getByRole("group", { name: "Sol Star System map" })).not.toBeInTheDocument()

    // Resolve the returned map afresh so an accidental remount cannot be hidden by
    // measuring a stale node from before navigation.
    expect(starWidth()).toBeCloseTo(zoomedWidth)
    expect(distanceFromMapCenter(map.element(), starHitArea(star.element()))).toBeLessThan(1)
  })
})
