import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SignUpPage } from "../features/auth/SignUpPage.tsx"
import type { ReactElement } from "react"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/_app/sign-up")({
  component: SignUpRoute,
  validateSearch: RedirectSchema,
})

function SignUpRoute(): ReactElement {
  const { redirect } = Route.useSearch()
  return <SignUpPage redirect={redirect} />
}
