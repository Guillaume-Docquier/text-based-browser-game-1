import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { SignIn } from "@clerk/react"

export const Route = createFileRoute("/sign-in")({
  component: RouteComponent,
})

function RouteComponent(): ReactElement {
  return <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/games" />
}
