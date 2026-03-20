import type { ReactElement } from "react"
import { createRoute, Link } from "@tanstack/react-router"
import { rootRoute } from "./Root.tsx"
import { homePageRoute } from "./HomePage.tsx"

function AnotherPage(): ReactElement {
  return (
    <div>
      <div>Another Page</div>
      <Link to={homePageRoute.to}>Go Back</Link>
    </div>
  )
}

export const anotherPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/another-page",
  component: () => <AnotherPage />,
})
