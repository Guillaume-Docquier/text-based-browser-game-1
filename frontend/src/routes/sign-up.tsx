import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { SignUp } from "@clerk/react"
import { z } from "zod"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/sign-up")({
  component: SignUpComponent,
  validateSearch: RedirectSchema,
})

function SignUpComponent(): ReactElement {
  const { redirect } = Route.useSearch()

  return <SignUp signInUrl={`/sign-in?redirect=${redirect}`} fallbackRedirectUrl={redirect} />
}
