import type { GameDetails, PlayerView } from "@api-types"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { useState } from "react"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { expect } from "storybook/test"
import { PlayGameContextProvider } from "@/features/play/PlayContext.tsx"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"
import { GalaxyPage } from "./GalaxyPage.tsx"

const alice = createPlayerStub()
const gameId = GameIdSchema.parse(42)
const target = createPlanetStub({ id: "planet-refresh-target", name: "Waypoint", coordinates: "1:2:3", x: 0.0001, y: 0 })
const star = createStarStub({ id: "star-refresh-target", name: "Northstar", coordinates: "1:2", x: 0, y: 0 })
const gameDetails: GameDetails = {
  id: gameId,
  winnerAccountId: null,
  configuration: {
    name: "Ownership Refresh",
    nbSeats: 1,
    turnIntervalSeconds: 3600,
    ruleset: { id: TestRuleset.id, name: TestRuleset.name, isDefault: TestRuleset.isDefault },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.000Z",
  endedAt: null,
  creator: alice,
  players: [alice],
  status: "IN_PROGRESS",
  canJoin: false,
  canLeave: false,
  canStart: false,
  canOpen: true,
}

const emptyResources = {
  [ResourceType.INFLUENCE]: { total: 0, uncommitted: 0 },
  [ResourceType.METAL]: { total: 0, uncommitted: 0 },
  [ResourceType.FUEL]: { total: 0, uncommitted: 0 },
  [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
  [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
}

const unclaimedView: PlayerView = {
  gameId,
  player: { id: alice.id, color: alice.color, isReady: false },
  opponents: {},
  galaxy: { systems: [{ star, planets: [target] }] },
  fleets: [],
  turn: 1,
  turnStatus: TurnStatus.COLLECTING_ACTIONS,
  turnEndsAt: "2026-01-01T01:00:00.000Z",
  resources: emptyResources,
  ruleset: TestRuleset,
  actions: [],
}

const claimedView: PlayerView = {
  ...unclaimedView,
  galaxy: { systems: [{ star, planets: [{ ...target, ownerPlayerId: alice.id }] }] },
  turn: 2,
}

const meta = {
  title: "Application/Galaxy Page",
  component: GalaxyPage,
  parameters: { layout: "fullscreen" },
  args: { initialPlanetId: target.id },
  render: ({ initialPlanetId }): ReactElement => <RefreshableGalaxy initialPlanetId={initialPlanetId} />,
} satisfies Meta<typeof GalaxyPage>

export default meta
type Story = StoryObj<typeof meta>

function RefreshableGalaxy({ initialPlanetId }: { initialPlanetId: typeof target.id | undefined }): ReactElement {
  const [isClaimed, setIsClaimed] = useState(false)
  return (
    <div className="flex h-screen flex-col">
      <button
        className="m-2 w-fit"
        type="button"
        onClick={() => {
          setIsClaimed(true)
        }}
      >
        Refresh owner
      </button>
      <PlayGameContextProvider value={{ gameDetails, playerView: isClaimed ? claimedView : unclaimedView }}>
        <GalaxyPage initialPlanetId={initialPlanetId} />
      </PlayGameContextProvider>
    </div>
  )
}

/**
 * The open detail pane and selected system read the claimed owner from the refreshed PlayerView.
 */
export const SelectedPlanetRefreshesOwnership: Story = {
  play: async ({ canvas, userEvent }) => {
    const details = canvas.getByRole("complementary", { name: "Waypoint details" })
    await expect(details).toHaveTextContent("Unclaimed")
    await expect(canvas.getByRole("button", { name: "View Waypoint details" })).toBeVisible()

    await userEvent.click(canvas.getByRole("button", { name: "Refresh owner" }))

    await expect(details).toHaveTextContent("Alice")
    await expect(canvas.getByRole("button", { name: "View Waypoint details, owned by Alice" })).toBeVisible()
  },
}
