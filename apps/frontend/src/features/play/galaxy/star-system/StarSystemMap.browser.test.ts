import { Assert } from "@guillaume-docquier/tools-ts"
import { composeStory } from "@storybook/react-vite"
import { describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { distanceFromMapCenter, starHitArea } from "../mapGeometry.test-support.ts"
import meta, { Interactive } from "./StarSystemMap.stories.tsx"

const story = composeStory({ ...Interactive, play: undefined }, meta, undefined, "Interactive")

describe("Star System map interactions", () => {
  it("should paint the hovered planet or star last and restore the original order on leave", async () => {
    await page.viewport(900, 800)
    await story.run()
    const map = page.getByRole("group", { name: "Sol Star System map" })
    const star = map.getByRole("button", { name: "Return to Galaxy from Sol" })
    const planet = map.getByRole("button", { name: "View Terra details" })
    // SVG paints later bodies above earlier ones; inspect semantic body order.
    const bodyOrder = (): Array<string | null> =>
      Array.from(map.element().querySelectorAll('[role="button"]'), (body) => body.getAttribute("aria-label"))
    const initialOrder = bodyOrder()

    await userEvent.hover(planet)
    await expect.poll(() => bodyOrder().at(-1)).toBe("View Terra details")
    await userEvent.hover(star)
    await expect.poll(() => bodyOrder().at(-1)).toBe("Return to Galaxy from Sol")
    await userEvent.hover(page.getByRole("button", { name: "Reset view" }))
    await expect.poll(bodyOrder).toEqual(initialOrder)
  })

  it("should recenter a panned map before signaling Return to Galaxy", async () => {
    await page.viewport(900, 800)
    await story.run()
    const map = page.getByRole("group", { name: "Sol Star System map" })
    const star = map.getByRole("button", { name: "Return to Galaxy from Sol" })
    const selection = page.getByRole("status", { name: "Selection" })
    const hitArea = starHitArea(star.element())
    await userEvent.dragAndDrop(map, map, {
      sourcePosition: { x: 100, y: 100 },
      targetPosition: { x: 180, y: 160 },
    })
    await expect.poll(() => distanceFromMapCenter(map.element(), hitArea)).toBeGreaterThan(80)

    // Pause the browser's actual transition in the mutation microtask, before the
    // next paint. Freeze only the JS fallback timer; no production durations change.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const transition = pauseTransformTransition(map.element())
    try {
      await userEvent.click(star)
      await expect.poll(() => transition.animation).toBeDefined()
      transition.disconnect()
      await expect.element(map).toHaveAttribute("aria-busy", "true")
      await expect.element(selection).toHaveTextContent("Sol")
      expect(distanceFromMapCenter(map.element(), hitArea)).toBeGreaterThan(80)

      Assert.isDefined(transition.animation)
      transition.animation.finish()
      await expect.element(selection).toHaveTextContent("Galaxy")
      await expect.element(map).toHaveAttribute("aria-busy", "false")
      expect(distanceFromMapCenter(map.element(), hitArea)).toBeLessThan(1)
    } finally {
      transition.disconnect()
      vi.useRealTimers()
    }
  })
})

function pauseTransformTransition(map: Element): { readonly animation: CSSTransition | undefined; disconnect: () => void } {
  let transition: CSSTransition | undefined
  const observer = new MutationObserver(() => {
    const animation = map
      .getAnimations({ subtree: true })
      .find((candidate): candidate is CSSTransition => candidate instanceof CSSTransition && candidate.transitionProperty === "transform")
    if (animation !== undefined) {
      animation.pause()
      transition = animation
    }
  })
  observer.observe(map, { attributes: true, subtree: true, attributeFilter: ["transform"] })
  return {
    get animation() {
      return transition
    },
    disconnect() {
      observer.disconnect()
    },
  }
}
