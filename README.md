# text-based-browser-game-1

A space strategy game

## Project status

The game has achieved its [proof of concept](https://github.com/Guillaume-Docquier/text-based-browser-game-1/milestone/1) stage.

We are now working on [the MVP](https://github.com/Guillaume-Docquier/text-based-browser-game-1/milestone/2).

For more info on the project, see [the milestones](https://github.com/Guillaume-Docquier/text-based-browser-game-1/milestones).

## Architecture

The project is structured as a basic monorepo, where each folder is a deployable project.

The game will have:

- A single React frontend
- A single Express backend
- Hosted infra (db, reverse proxy)

![infra.png](./.github/images/infra.png)

Long term, the backend project will be split in two:

- API for the frontend
- Workers to simulate ticks

This will allow scaling the workers and the API appropriately. The workers might even be in another language more suited for CPU bound tasks.  
Until we start seeing performance problems, we won't need that, so we'll start with a single backend.  
However, since we know a single backend won't scale, we'll make sure the tick simulation is well isolated so that we can extract it quickly when needed.

All the tech choices are balanced to make sure we don't take on too many new things.  
For example, we chose:

- Typescript (proficient)
- React (proficient)
- Express (proficient)
- pnpm (familiar)
- Tanstack query (familiar)
- Tanstack router (new)
- No monorepo power tool (new)
- Drizzle (new)
- Clerk (new)
- Railway (new)
- Postgres (new)

While Express and Typescript everywhere might not be the most suitable options, they'll give us a safe playground to learn the other necessary tools (auth, db and hosting, for the most part).

## Architecture Decision Records (ADRs)

Architecture Decision Records are simple snapshots of decisions that were made, with their status and context.  
They are all version controlled in the [docs/adr/](./docs/adr/) directory.

## Game design

The game design, at every stage of its life, will be documented in [docs/](./docs/) in Markdown files.  
One file will contain the latest, up-to-date game design & philosophy, but we'll keep the original documents as well (mvp, alpha, beta, 1.0, etc)
