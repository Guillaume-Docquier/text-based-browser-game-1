import type { ReactElement } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({
  component: About,
})

function About(): ReactElement {
  return (
    <div>
      <div>Another Page</div>
      <Link to="/">Go Back</Link>
    </div>
  )
}
