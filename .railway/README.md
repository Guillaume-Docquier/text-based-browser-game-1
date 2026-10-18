# Railway configuration

`.railway/railway.ts` describes the existing `cosmic-empires` Railway project. Service variable values remain in Railway; the file deliberately sets `variables.managed` to `false`.

## First deployment

1. Merge the IaC pull request while the backend and frontend `railway.json` files remain in the repository. GitHub deployments continue to read those files until cutover.
2. From an updated `main` checkout, link to the `cosmic-empires` project and its `production` environment with `railway link`, then confirm the target with `railway status`.
3. Run `railway config migrate status`. It should list only `Backend` and `Frontend` as still using Config as Code. Confirm that `railway config plan` can evaluate the IaC file and reaches the expected Config as Code ownership error before cutover. Resolve any CLI evaluation error first.
4. Run `railway config migrate cutover`. This changes those two live services to stop reading their `railway.json` files. Apply the IaC configuration before pushing another application change.
5. Run `railway config plan` and inspect every proposed change. The plan should migrate the backend and frontend build and deploy settings without deleting services, variables, or the Postgres volume. Resolve any unexpected change before proceeding. If the plan is unsafe, run `railway config migrate undo` to restore the previous Config as Code paths.
6. Run `railway config apply`, then run `railway config plan` again to confirm that the environment is up to date.
7. Remove the old `railway.json` files in a follow-up pull request after the live migration succeeds.

For later configuration changes, edit `railway.ts`, review `railway config plan`, and then run `railway config apply` against the intended environment.
