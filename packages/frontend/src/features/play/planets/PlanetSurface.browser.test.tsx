import { createBuildingStub } from "shared/domain/world/buildings/Building.stub.ts"
import { describe, expect, it } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import commandCenterArt from "@/assets/buildings/command-center.png"
import oceanicArt from "@/assets/planets/oceanic-small.png"
import { observedPlanetStub } from "../observation.stub.ts"
import { PlanetSurface } from "./PlanetSurface.tsx"

describe("PlanetSurface", () => {
  it("should meet SURF-0001 When the player reloads or reopens a surface, when building records arrive in a different order, or when a building occupies an empty hex, all existing hexes retain their positions relative to the center.", async () => {
    const planet = observedPlanetStub({ name: "Prospect", area: 8 })
    const elsewhere = createBuildingStub({ planetId: observedPlanetStub().id })
    const center = createBuildingStub({ planetId: planet.id })
    const props = { planet, artwork: oceanicArt }
    const view = await render(<PlanetSurface {...props} buildings={[elsewhere]} />)
    const hexes = page.getByRole("group", { name: "Surface hexes" }).getByRole("button")
    const positions = (): Array<string | null> => hexes.all().map((hex) => hex.element().getAttribute("transform"))
    const initial = positions()

    await page.mark("Choose an empty site before placing a building", async () => {
      expect(initial).toHaveLength(8)
      await expect.element(page.getByRole("button", { name: "Center hex, Empty" })).toBeVisible()
      await page.getByRole("button", { name: "Hex 2, Empty" }).click()
    })

    await page.mark("Occupy the center and keep the neighboring site selected", async () => {
      await view.rerender(<PlanetSurface {...props} buildings={[elsewhere, center]} />)
      expect(positions()).toStrictEqual(initial)
      const occupied = page.getByRole("button", { name: "Center hex, Command center" })
      await expect.element(occupied).toBeVisible()
      expect(occupied.element().querySelector("image")?.getAttribute("href")).toBe(commandCenterArt)
      await expect.element(page.getByRole("button", { name: "Hex 2, Empty" })).toHaveAttribute("aria-pressed", "true")
    })

    await page.mark("Reopen the surface with records in a different order", async () => {
      await view.unmount()
      await render(<PlanetSurface {...props} buildings={[center, elsewhere]} />)
      expect(positions()).toStrictEqual(initial)
      await expect.element(page.getByRole("button", { name: "Center hex, Command center" })).toHaveAttribute("aria-pressed", "true")
      await expect.element(page.getByRole("status", { name: "Selected site" })).toHaveTextContent("Center hex·Command center")
    })
  })
})
