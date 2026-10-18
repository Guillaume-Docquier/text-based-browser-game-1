# Railway configuration

`.railway/railway.ts` describes the existing `cosmic-empires` Railway project. Service variable values remain in Railway; the file deliberately sets `variables.managed` to `false`.

## First deployment

Complete this migration from a checkout of the pull request branch before merging it:

1. Link the checkout to the `cosmic-empires` project and its `production` environment with `railway link`, then confirm the target with `railway status`.
2. Run `railway config migrate status`. It should list only `Backend` and `Frontend` as still using Config as Code.
3. Run `railway config migrate cutover`. This changes those two live services to stop reading their `railway.json` files.
4. Run `railway config plan` and inspect every proposed change. The plan should migrate the backend and frontend build and deploy settings without deleting services, variables, or the Postgres volume. Resolve any unexpected change before proceeding.
5. Run `railway config apply`, then run `railway config plan` again to confirm that the environment is up to date.
6. Merge the pull request after the cutover and apply succeed. The pull request deletes the old `railway.json` files.

For later configuration changes, edit `railway.ts`, review `railway config plan`, and then run `railway config apply` against the intended environment.
