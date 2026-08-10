# Postgres

We use Postgres as the main database. However, the setup isn't the best, and we have many versions to keep in sync.

Current version is 18.4

## Updating the Postgres version

To update the Postgres version, we need to update:

- The dev setup docker-compose file
- The production Postgres image
- The concurrency tests devContainers image
- The GitHub Actions service
