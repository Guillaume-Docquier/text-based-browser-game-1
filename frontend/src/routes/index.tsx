import { type ReactElement } from "react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index(): ReactElement {
  return (
    <div className="flex flex-col items-center text-white h-[calc(100vh-theme(space.16))] py-30">
      <div className="flex flex-col items-center w-200 text-center justify-between h-full">
        <h1 className="text-6xl font-bold">Build your empire and dominate the galaxy</h1>
        <p className="text-3xl">
          Cosmic Empires is a deep text based strategy game. Build bases, develop an economy, craft specialized spaceships and position your
          fleets. Trade technologies and intel to establish dominance.
        </p>
        <button className="text-3xl font-semibold uppercase bg-primary-50 text-dark-50 py-6 px-10 rounded-xl cursor-pointer">
          Play for free
        </button>
      </div>
    </div>
  )
}
