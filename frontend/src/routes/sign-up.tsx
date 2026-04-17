import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { SignUp } from "@clerk/react"
import { z } from "zod"
import { AuthPageShell } from "../components/AuthPageShell.tsx"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/sign-up")({
  component: SignUpComponent,
  validateSearch: RedirectSchema,
})

function SignUpComponent(): ReactElement {
  const { redirect } = Route.useSearch()

  return (
    <AuthPageShell
      title="Start your empire"
      description="Create your account to join a lobby, claim a faction, and start competing for long-term control of the galaxy."
    >
      <SignUp signInUrl={`/sign-in?redirect=${redirect}`} fallbackRedirectUrl={redirect} />
    </AuthPageShell>
  )
}
