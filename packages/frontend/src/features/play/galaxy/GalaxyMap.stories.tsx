import { branded, noop } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { createGalaxyStub } from "shared/domain/world/Galaxy.stub.ts"
import { SUN_ID } from "shared/domain/world/Sol.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "shared/domain/world/StarSystem.stub.ts"
import { Button } from "@/components/button.tsx"
import { observedSystemStub } from "../observation.stub.ts"
import { GalaxyMap } from "./GalaxyMap.tsx"

const meta = {
  title: "Application/Galaxy Map",
  component: GalaxyMap,
  args: {
    galaxy: {
      systems: createGalaxyStub({
        systems: [
          createStarSystemStub({ star: createStarStub({ name: "Vega", x: 29.92, y: 40 }) }),
          createStarSystemStub({
            star: createStarStub({ id: SUN_ID, name: "Sun", x: 30, y: 40 }),
          }),
        ],
      }).systems.map(observedSystemStub),
    },
    currentPlayerId: branded("00000000-0000-4000-8000-000000000002"),
    resetSignal: 0,
    onSelectSystem: noop,
  },
} satisfies Meta<typeof GalaxyMap>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: function Render(args) {
    const [resetSignal, setResetSignal] = useState(args.resetSignal)
    const [selection, setSelection] = useState("Galaxy")
    return (
      <div>
        <Button
          onClick={() => {
            setResetSignal((value) => value + 1)
          }}
        >
          Reset view
        </Button>
        <output aria-label="Selection" className="ml-4">
          {selection}
        </output>
        <div style={{ width: 600, height: 600 }}>
          <GalaxyMap
            {...args}
            resetSignal={resetSignal}
            onSelectSystem={(system) => {
              setSelection(system.star.name)
            }}
          />
        </div>
      </div>
    )
  },
}
