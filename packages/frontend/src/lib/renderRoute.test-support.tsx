import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { onTestFinished } from "vitest"

export function renderRoute(page: ReactElement): void {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => page }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  const container = document.body.appendChild(document.createElement("div"))
  const root = createRoot(container)
  onTestFinished(() => {
    root.unmount()
    container.remove()
  })
  root.render(<RouterProvider router={router} />)
}
