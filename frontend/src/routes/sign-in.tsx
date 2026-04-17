import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { SignIn } from "@clerk/react"
import { z } from "zod"
import { AuthPageShell } from "../components/AuthPageShell.tsx"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/sign-in")({
  component: SignInComponent,
  validateSearch: RedirectSchema,
})

function SignInComponent(): ReactElement {
  const { redirect } = Route.useSearch()

  return (
    <AuthPageShell
      title="Welcome back"
      description="Sign in to manage your ongoing campaigns, review intel, and jump back into your empire before the next tick lands."
    >
      <SignIn signUpUrl={`/sign-up?redirect=${redirect}`} fallbackRedirectUrl={redirect} />
    </AuthPageShell>
  )
}
