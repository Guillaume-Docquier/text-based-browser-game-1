import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { ShipsPage } from "@/features/play/ships/ShipsPage.tsx"
const search = z.object({ shipId: z.string().optional(), bodyKind: z.enum(["star", "planet"]).optional(), bodyId: z.string().optional() })
export const Route = createFileRoute("/_game/games/$gameId/play/ships")({ validateSearch: search, component: ShipsRoute })
function ShipsRoute(): React.JSX.Element {
  const { shipId, bodyId, bodyKind } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ShipsPage
      key={JSON.stringify([shipId, bodyKind, bodyId])}
      selectShip={(id) => {
        void navigate({ search: (previous) => ({ ...previous, shipId: id }), replace: true })
      }}
      initialShipId={shipId}
      bodyId={bodyId}
      bodyKind={bodyKind}
    />
  )
}
