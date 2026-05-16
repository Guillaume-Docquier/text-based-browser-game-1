import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SignInPage } from "../features/auth/pages/SignInPage.tsx"

const RedirectSchema = z.object({
  redirect: z.string().default("/games"),
})

export const Route = createFileRoute("/_app/sign-in")({
  component: SignInRoute,
  validateSearch: RedirectSchema,
})

function SignInRoute() {
  const { redirect } = Route.useSearch()
  return <SignInPage redirect={redirect} />
}
