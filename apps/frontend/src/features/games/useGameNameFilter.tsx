import type * as ApiTypes from "@api-types"
import { Search } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/input.tsx"
import type { Filter } from "@/features/games/Filter.ts"

export function useGameNameFilter(): Filter<ApiTypes.Listing> {
  const [gameName, setGameName] = useState("")

  return {
    predicate: gameName === "" ? undefined : (listing) => listing.name.includes(gameName),
    element: (
      <div key="game-name" className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={gameName}
          onChange={(event) => {
            setGameName(event.target.value)
          }}
          placeholder="Search for games"
          className="pl-9"
        />
      </div>
    ),
  }
}
