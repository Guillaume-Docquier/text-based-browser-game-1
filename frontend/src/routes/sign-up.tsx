import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { SignUp } from "@clerk/react"

export const Route = createFileRoute("/sign-up")({
  component: RouteComponent,
})

function RouteComponent(): ReactElement {
  return <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/games" />
}
