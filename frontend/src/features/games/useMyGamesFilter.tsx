import type * as ApiTypes from "@api-types"
import { UserRoundCheck } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/button.tsx"
import type { Filter } from "@/features/games/Filter.ts"

export function useMyGamesFilter(): Filter<ApiTypes.Listing> {
  const [showOnlyMyGames, setShowOnlyMyGames] = useState(false)

  return {
    predicate: showOnlyMyGames ? (listing) => listing.hasJoined : undefined,
    element: (
      <Button
        key="my-games"
        type="button"
        variant={showOnlyMyGames ? "secondary" : "outline"}
        aria-pressed={showOnlyMyGames}
        onClick={() => {
          setShowOnlyMyGames(!showOnlyMyGames)
        }}
      >
        <UserRoundCheck />
        My games
      </Button>
    ),
  }
}
