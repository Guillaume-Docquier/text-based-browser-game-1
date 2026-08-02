# Turn Processing in Worker Threads

## Status

Accepted

## Context

We'll need workers to process game turns.

Each game will queue a next turn when the game starts.

Workers will pick turns to process, and queue the next turn when they're done.

We'll need a way to scale the number of workers so that pending turns don't accumulate.

Processing a turn is CPU bound. There's going to be mostly no IO. Read from DB, do the work, write to DB.

Turns won't be too frequent. A typical turn interval would be 1 day, so games would have 1 turn to process per day.

However, there might be games configured with more frequent turns, or games with active players that ready-up to pass turns quickly.

And of course, there's the number of games in parallel.

## Decision

We won't need high scalability in the medium and even long term. For this reason, we'll use a single worker thread on the web server.

Using a worker thread will force us to decouple the worker from the web server, making it easily extractable later.

The web server will depend on the worker because the worker will contain the game logic, but the worker shouldn't depend on the web server.

Running as a thread on the same server means 0 extra infra to set up and we can share all the code easily.

## Consequences

We won't be able to horizontally scale efficiently, because deploying a replica will mean also deploying a web server.

But if we need to, we should easily be able to scale vertically by adding more threads. And that shouldn't happen anytime soon (I wish!).
