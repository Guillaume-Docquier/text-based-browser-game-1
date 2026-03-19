# Avoid Docker for Code

## Status

Accepted

## Context

We deploy to Railway via code, and they do our Docker images.

We have all the tooling installed for development of our code, so why containerize it for development?

It's useful to spin up infra, like databases, but not for spinning up our application.

## Decision

We will not use Docker as a development tool for services that we develop.

We will use it for 3rd party services, like databases.

We will use Webstorm run configs to start the project.

## Consequences

Someone who wants to run the project without developing it will have a harder time.

Since we don't invest into Docker images, maybe Railway's images are not optimal. However, we can always create optimized images for deployment. We just won't use them for development.
