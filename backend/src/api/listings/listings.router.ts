import { type Logger } from "@guillaume-docquier/tools-ts"
import z from "zod"
import type { Trpc } from "#api/trpc.ts"
import { type ListingsController, ListingDto } from "./listings.controller.ts"

/**
 * Import side effect free express router creator.
 * It receives all dependencies so we can easily mock them during tests.
 * It also decouples the router from those dependencies, if done well.
 */
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createListingsRouter({
  trpc,
  listingsController,
  ...others
}: {
  trpc: Trpc
  listingsController: ListingsController
  logger: Logger
}) {
  // oxlint-disable-next-line no-unused-vars -- Someday we'll need it
  const listingsRouterLogger = others.logger.child({ scope: "listings-router" })

  return trpc.router({
    /**
     * Gets all game listings, and eventually will support queries (by name, by state, etc) and pagination
     */
    getListings: trpc.publicProcedure.output(z.array(ListingDto)).query(async () => {
      return await listingsController.getListings()
    }),
  })
}
