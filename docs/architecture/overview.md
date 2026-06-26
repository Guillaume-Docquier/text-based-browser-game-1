# Overview

The project is structured as a pnpm workspace monorepo with separate deployable frontend and backend packages.

The game will have:

- A single React frontend
- A single Express backend
- Hosted infra (db, reverse proxy)

![infra.png](../../.github/images/infra.png)

Long term, the backend project will be split in two:

- API for the frontend
- Workers to simulate ticks

This will allow scaling the workers and the API appropriately. The workers might even be in another language more suited for CPU bound tasks.  
Until we start seeing performance problems, we won't need that, so we'll start with a single backend.  
However, since we know a single backend won't scale, we'll make sure the tick simulation is well isolated so that we can extract it quickly when needed.

All the tech choices are balanced to make sure we don't take on too many new things.  
For example, we chose:

- TypeScript (proficient)
- React (proficient)
- Express (proficient)
- pnpm workspaces (familiar)
- Tanstack query (familiar)
- Tanstack router (new)
- No monorepo power tool (new)
- Drizzle (new)
- Clerk (new)
- Railway (new)
- Postgres (new)

While Express and TypeScript everywhere might not be the most suitable options, they'll give us a safe playground to learn the other necessary tools (auth, db and hosting, for the most part).
