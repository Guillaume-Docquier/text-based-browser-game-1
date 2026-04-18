import { type ParsedLocation, redirect } from "@tanstack/react-router"
import type { RouterContext } from "./routes/__root.tsx"
import { noop } from "@guillaume-docquier/tools-ts"

/**
 * A guard for routes that require authentication.
 * Use inside your route `beforeLoad`.
 * It will throw a `redirect` to sign-in if the user is not authenticated.
 *
 * @example
 * ```ts
 * import { createFileRoute } from "@tanstack/react-router"
 * import { privateRoute } from "@/privateRoute.ts"
 *
 * export const Route = createFileRoute("/my-route")({
 *   component: MyRoute,
 *   beforeLoad: privateRoute,
 * })
 *
 * // or
 *
 * export const Route = createFileRoute("/my-route")({
 *   component: MyRoute,
 *   beforeLoad: ({ context, location }) => {
 *     // Will throw if not authenticated
 *     privateRoute({ context, location })
 *
 *     // do your things
 *   },
 * })
 * ```
 */
export function privateRoute({ context, location }: { context: RouterContext; location: ParsedLocation }): void {
  if (!context.auth.isLoaded) {
    // Wait for auth to kick in
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- That's how tanstack works
    throw new Promise(noop)
  }

  if (!context.auth.isSignedIn) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- That's how tanstack works
    throw redirect({
      to: "/sign-in",
      search: {
        redirect: location.href,
      },
    })
  }
}
