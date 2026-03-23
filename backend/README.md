# Cosmic Empires Backend

## Database

### Playing with the db

Update the db tables based on `src/db/schema.ts`

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
