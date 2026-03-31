import type { ReactElement } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"

export const Route = createFileRoute("/games")({
  component: Games,
})

function Games(): ReactElement {
  const games = []

  return (
    <div className="flex flex-col items-center text-white h-[calc(100vh-theme(space.16))] py-30">
      <div className="p-8 w-200 bg-surface-100 flex flex-col gap-y-3 rounded-xl">
        <div className="flex flex-row gap-2 items-center">
          <Search />
          <input placeholder="search for games" className="w-full py-1 px-2" />
        </div>
        <div>{games.length === 0 ? "No games found" : "Games"}</div>
      </div>
    </div>
  )
}
