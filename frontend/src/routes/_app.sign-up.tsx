import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SignUpPage } from "../features/auth/pages/SignUpPage.tsx"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/_app/sign-up")({
  component: SignUpRoute,
  validateSearch: RedirectSchema,
})

function SignUpRoute() {
  const { redirect } = Route.useSearch()
  return <SignUpPage redirect={redirect} />
}
