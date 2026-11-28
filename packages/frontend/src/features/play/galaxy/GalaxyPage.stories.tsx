import { Distance, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useParams,
} from "@tanstack/react-router"
import { type ReactElement, useState } from "react"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { PlanetIdSchema } from "shared/domain/world/planets/PlanetId.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { StarIdSchema } from "shared/domain/world/stars/StarId.ts"
import { createStarSystemStub } from "shared/domain/world/StarSystem.stub.ts"
import { StarSystemSchema } from "shared/domain/world/StarSystem.ts"
import { z } from "zod"
import { PlanetPage } from "../planets/PlanetPage.tsx"
import { createPlayGameContextStub } from "../PlayContext.stub.ts"
import { PlayGameContextProvider } from "../PlayContext.tsx"
import { GalaxyPage } from "./GalaxyPage.tsx"

const context = createPlayGameContextStub({
  galaxy: {
    systems: [
      StarSystemSchema.parse(
        createStarSystemStub({
          star: createStarStub({ id: "00000000-0000-4000-8000-000000000003", name: "Rigel", x: 30, y: 40 }),
          planets: [
            createPlanetStub({
              id: "00000000-0000-4000-8000-000000000004",
              name: "Terra",
              x: 30 + Distance.in(Distance.create(5, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS),
              y: 40,
            }),
          ],
        }),
      ),
    ],
  },
})

const meta = {
  title: "Application/Galaxy Page",
  component: GalaxyPage,
  args: { starId: undefined },
  decorators: [
    (Story): ReactElement => (
      <PlayGameContextProvider {...context}>
        <div className="flex" style={{ width: 600, height: 600 }}>
          <Story />
        </div>
      </PlayGameContextProvider>
    ),
  ],
} satisfies Meta<typeof GalaxyPage>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: function Render() {
    const [router] = useState(createStoryRouter)
    return <RouterProvider router={router} />
  },
}

function createStoryRouter(): AnyRouter {
  const root = createRootRoute()
  const map = createRoute({
    getParentRoute: () => root,
    path: "/games/$gameId/play/galaxy",
    validateSearch: z.object({ starId: StarIdSchema.exactOptional() }),
    component: function Map() {
      const { starId } = map.useSearch()
      return <GalaxyPage starId={starId} />
    },
  })
  const planet = createRoute({
    getParentRoute: () => root,
    path: "/games/$gameId/play/planet/$planetId",
    component: SelectedPlanet,
  })
  return createRouter({
    routeTree: root.addChildren([map, planet]),
    history: createMemoryHistory({ initialEntries: ["/games/1/play/galaxy"] }),
  })
}

function SelectedPlanet(): ReactElement {
  const { planetId } = useParams({ strict: false })
  return <PlanetPage planetId={PlanetIdSchema.parse(planetId)} />
}

export const PlanetProfile: Story = {
  ...Interactive,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "View Rigel Star System" }))
    await userEvent.click(await canvas.findByRole("button", { name: "View Terra details" }))
    await canvas.findByRole("article", { name: "Terra" })
  },
}
