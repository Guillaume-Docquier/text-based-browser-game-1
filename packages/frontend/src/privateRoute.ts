import { type ParsedLocation, redirect } from "@tanstack/react-router"
import type { RouterContext } from "@/routes/__root.tsx"

export function privateRoute({ context, location }: { context: RouterContext; location: ParsedLocation }): void {
  if (context.auth.isSignedIn !== true) {
    // oxlint-disable-next-line typescript/only-throw-error -- That's how tanstack works
    throw redirect({
      to: "/sign-in",
      search: {
        redirect: location.href,
      },
    })
  }
}
