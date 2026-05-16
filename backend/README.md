# Cosmic Empires Backend

## Architecture

3rd parties (Auth, Db), the networking layer (routers) and the domain logic (controllers) are decoupled.  
This allows changing tech at any time with low incidence, if done well.  
We chose Express for now, but it might be lackluster. If the only Express footprint is in the routers, then changing Express is easy.

Import side effects and globally shared state are not tolerated.

We use DI for inversion of control to make code easier to test and decoupled from implementation details.

## Database

### Playing with the db

You can update the db tables based on `src/lib/db/schema.ts` without generating migrations. This is good for experimentation before generating migrations once the schemas are decided.

```bash
pnpm drizzle-kit push
```

More on drizzle-kit here: https://orm.drizzle.team/docs/kit-overview

### Creating migrations

Create db migrations with drizzle-kit

```bash
pnpm db:generate --name=NAME_OF_MIGRATION
```

Which can then be applied.  
You need the `DATABASE_URL` env var for this.

```bash
pnpm db:migrate
```

### Seeding the database

There's a script to wipe the db and add default data.
You need the `DATABASE_URL` env var for this.

```bash
pnpm db:seed
```
