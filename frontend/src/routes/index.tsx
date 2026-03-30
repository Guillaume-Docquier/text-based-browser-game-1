import { type ReactElement } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@headlessui/react"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index(): ReactElement {
  return (
    <div className="flex flex-col items-center bg-[url(/src/assets/home-bg-spaceships.png)] text-white h-[calc(100vh-theme(space.16))] py-30">
      <div className="flex flex-col items-center w-200 text-center justify-between h-full">
        <h1 className="text-6xl font-bold [text-shadow:0px_0px_20px_rgba(29,185,208,1)]">Build your empire and dominate the galaxy</h1>
        <p className="text-3xl [text-shadow:0px_0px_20px_rgba(0,0,0,1)]">
          Cosmic Empires is a deep text based strategy game. Build bases, develop an economy, craft specialized spaceships and position your
          fleets. Trade technologies and intel to establish dominance.
        </p>
        <Button className="text-4xl uppercase bg-blue-800 py-6 px-10 rounded-2xl cursor-pointer">Play for free</Button>
      </div>
    </div>
  )
}
