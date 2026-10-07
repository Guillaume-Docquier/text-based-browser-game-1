import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "shared/domain/world/StarSystem.stub.ts"
import { StarSystemSchema } from "shared/domain/world/StarSystem.ts"
import { createPlayGameContextStub } from "../PlayContext.stub.ts"
import { PlayGameContextProvider } from "../PlayContext.tsx"
import { GalaxyPage } from "./GalaxyPage.tsx"

const context = createPlayGameContextStub({
  galaxy: {
    systems: [
      StarSystemSchema.parse(
        createStarSystemStub({
          star: createStarStub({ id: "00000000-0000-4000-8000-000000000003", name: "Sol", x: 30, y: 40 }),
        }),
      ),
    ],
  },
})

const meta = {
  title: "Application/Galaxy Page",
  component: GalaxyPage,
  args: { initialPlanetId: undefined },
  decorators: [
    (Story): ReactElement => (
      <PlayGameContextProvider value={context}>
        <div className="flex" style={{ width: 600, height: 600 }}>
          <Story />
        </div>
      </PlayGameContextProvider>
    ),
  ],
} satisfies Meta<typeof GalaxyPage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Exercises the page's real map mounting and exit lifecycle. Its native browser
 * test protects camera preservation across a Star System round trip.
 */
export const RoundTrip: Story = {}
