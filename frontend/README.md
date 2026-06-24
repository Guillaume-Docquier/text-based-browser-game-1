# Cosmic Empires Frontend

## Architecture

We use file-based routing via Tanstack Router.

This frontend will host all of Cosmic Empires, including the public pages, the authenticated pages and the game.

We might pull out the public pages into a static site later on, who knows.

## End-to-end tests

The Playwright suite runs locally against the Vite development server, the NodeJS backend and the db and uses Chromium. They all start and stop automatically when launching the tests.

Add these values to `frontend/.env`:

```dotenv
CLERK_SECRET_KEY=sk_test_...
E2E_CLERK_USER_EMAIL=e2e+clerk_test@example.com
```

`E2E_CLERK_USER_EMAIL` must identify an existing user in the same Clerk development instance. The `+clerk_test` suffix prevents Clerk from sending emails to that address. `CLERK_SECRET_KEY` has no `VITE_` prefix and is therefore not exposed to frontend code.

Install Chromium once, then run the tests:

```shell
pnpm --filter frontend e2e:install
pnpm --filter frontend e2e
```

Use `pnpm --filter frontend e2e:ui` for Playwright's local interactive runner.
