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
pnpm drizzle-kit generate --name=NAME_OF_MIGRATION
```

Which can then be applied

```bash
pnpm drizzle-kit migrate
```
