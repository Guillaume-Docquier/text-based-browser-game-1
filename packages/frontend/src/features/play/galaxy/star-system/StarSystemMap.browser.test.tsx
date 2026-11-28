import { Assert } from "@guillaume-docquier/tools-ts"
import { composeStories } from "@storybook/react-vite"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import gasArt from "@/assets/planets/gas.png"
import { distanceFromMapCenter, starHitArea } from "@/testing/mapGeometry.ts"
import * as stories from "./StarSystemMap.stories.tsx"

const { Interactive, SolarSystem, GasPlanet } = composeStories(stories)

async function renderMap(): Promise<void> {
  await page.viewport(900, 800)
  await Interactive.run()
  await page.getByRole("button", { name: "Reset view" }).click()
}

describe("Star System map interactions", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("should paint the hovered planet or star last and restore the original order on leave", async () => {
    await renderMap()
    const map = page.getByRole("group", { name: "Sol Star System map" })
    const star = map.getByRole("button", { name: "Return to Galaxy from Sol" })
    const planet = map.getByRole("button", { name: "View Terra details" })
    const bodyOrder = (): Array<string | null> =>
      Array.from(map.element().querySelectorAll('[role="button"]'), (body) => body.getAttribute("aria-label"))

    await page.mark("Hover each body to bring it to the foreground", async () => {
      await planet.hover()
      await expect.poll(() => bodyOrder().at(-1)).toBe("View Terra details")
      await star.hover()
      await expect.poll(() => bodyOrder().at(-1)).toBe("Return to Galaxy from Sol")
    })

    await page.mark("Leave the map to restore the original paint order", async () => {
      await page.getByRole("button", { name: "Reset view" }).hover()
      await expect.poll(bodyOrder).toEqual(["Return to Galaxy from Sol", "View Terra details", "View Mars details"])
    })
  })

  it("should recenter a panned map before signaling Return to Galaxy", async ({ onTestFinished }) => {
    await renderMap()
    const map = page.getByRole("group", { name: "Sol Star System map" })
    const star = map.getByRole("button", { name: "Return to Galaxy from Sol" })
    const selection = page.getByRole("status", { name: "Selection" })
    const hitArea = starHitArea(star.element())

    await page.mark("Pan the star away from the center", async () => {
      await userEvent.dragAndDrop(map, map, {
        sourcePosition: { x: 100, y: 100 },
        targetPosition: { x: 180, y: 160 },
      })
      await expect.poll(() => distanceFromMapCenter(map.element(), hitArea)).toBeGreaterThan(80)
    })

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const transition = pauseTransformTransition(map.element())
    onTestFinished(() => {
      transition.disconnect()
      transition.animation?.cancel()
    })

    await page.mark("Keep the system selected while centering is paused", async () => {
      await star.click()
      await expect.poll(() => transition.animation).toBeDefined()
      transition.disconnect()
      await expect.element(map).toHaveAttribute("aria-busy", "true")
      await expect.element(selection).toHaveTextContent("Sol")
      expect(distanceFromMapCenter(map.element(), hitArea)).toBeGreaterThan(80)
    })

    await page.mark("Finish the real transition before returning to Galaxy", async () => {
      Assert.isDefined(transition.animation)
      transition.animation.finish()
      await expect.element(selection).toHaveTextContent("Galaxy")
      await expect.element(map).toHaveAttribute("aria-busy", "false")
      expect(distanceFromMapCenter(map.element(), hitArea)).toBeLessThan(1)
    })
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

describe("Solar and gas planet artwork", () => {
  it("should meet SMAP-0001 When a player opens Sol, they can identify the Sun and all eight planets by their real names, distinct artwork and public coordinates.", async () => {
    await SolarSystem.run()
    await page.mark("Inspect the Sun and all eight planets", async () => {
      const map = page.getByRole("group", { name: "Sol Star System map" })
      const art = new Set<string | null | undefined>()
      const sun = map.getByRole("button", { name: "Return to Galaxy from Sun" }).element()
      expect(sun.querySelector("title")?.textContent).toMatch(/Sun · \d\d:\d\d/)
      art.add(sun.querySelector("image")?.getAttribute("href"))
      for (const name of ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]) {
        const planet = map.getByRole("button", { name: `View ${name} details` }).element()
        expect(planet.querySelector("text")?.textContent).toBe(name)
        expect(planet.querySelector("title")?.textContent).toMatch(/\d\d:\d\d:[\d.]+/)
        art.add(planet.querySelector("image")?.getAttribute("href"))
      }
      expect(art.has(null)).toBe(false)
      expect(art.has(undefined)).toBe(false)
      expect(art.size).toBe(9)
    })
  })

  it("should meet PART-0001 When a gas planet outside Sol is shown, it uses dedicated gas-biome artwork.", async () => {
    await GasPlanet.run()
    await page.mark("Inspect an ordinary gas planet", async () => {
      const planet = page.getByRole("button", { name: "View Cirrus details" })
      expect(planet.element().querySelector("image")?.getAttribute("href")).toBe(gasArt)
    })
  })
})
