import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { SignIn } from "@clerk/react"
import { z } from "zod"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/sign-in")({
  component: SignInComponent,
  validateSearch: RedirectSchema,
})

function SignInComponent(): ReactElement {
  const { redirect } = Route.useSearch()

  return <SignIn signUpUrl={`/sign-up?redirect=${redirect}`} fallbackRedirectUrl={redirect} />
}
