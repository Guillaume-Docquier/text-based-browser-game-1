import { createPlayerStub } from "shared/domain/players/Player.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { renderApplicationPage } from "@/testing/renderApplicationPage.tsx"
import { createPlayGameContextStub } from "../PlayContext.stub.ts"
import { PlayGameContextProvider } from "../PlayContext.tsx"
import { PlanetPage } from "./PlanetPage.tsx"

describe("PlanetPage", () => {
  it("should meet PV-0002 When a planet view opens, the player can identify the planet by name and coordinates and inspect its available ownership, biome, size, area, metal production and remaining deposit alongside space for its surface.", async () => {
    const player = createPlayerStub()
    const planet = createPlanetStub({
      name: "Atlas",
      coordinates: "45:16:05",
      ownerPlayerId: player.id,
      biome: PlanetBiome.METALLIC,
      area: 5,
      metalProduction: 2,
      remainingMetalDeposit: 14,
    })
    const context = createPlayGameContextStub({ galaxy: { systems: [{ star: createStarStub({ name: "Rigel" }), planets: [planet] }] } })
    await renderApplicationPage(
      <PlayGameContextProvider {...context}>
        <PlanetPage planetId={planet.id} />
      </PlayGameContextProvider>,
    )

    await page.mark("Read the planet's attributes beside its surface", async () => {
      const view = page.getByRole("article", { name: "Atlas" })
      await expect.element(view.getByRole("heading", { name: "Atlas", level: 1 })).toBeVisible()
      await expect.element(view.getByRole("region", { name: "Planet surface" }).getByRole("img", { name: "Atlas" })).toBeVisible()
      const attributes = view.getByRole("region", { name: "Planet attributes" })
      expect(
        attributes
          .getByRole("term")
          .all()
          .map((term) => term.element().textContent),
      ).toStrictEqual(["Coordinates", "Owner", "Biome", "Size", "Area", "Metal production per mine per turn", "Remaining metal deposit"])
      expect(
        attributes
          .getByRole("definition")
          .all()
          .map((value) => value.element().textContent),
      ).toStrictEqual(["45:16:05", "Alice", "Metallic", "Small", "5 slots", "2", "14"])
    })
  })
})
