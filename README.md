# Services migrations

MongoDB schema and data migrations for the CVE services. Migrations are managed with `migrate-mongo` and run in filename order.

## Setup

Install the Node.js dependencies and create a local environment file:

```sh
npm install
cp env.default .env
```

Edit `.env` with the connection details for the target MongoDB database. The file is ignored by Git; `env.default` contains example values only.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Defaults to `development`. Any other value enables TLS and the AWS connection settings in the migration config. |
| `MONGO_HOST` | MongoDB host when building a connection string. |
| `MONGO_PORT` | MongoDB port when building a connection string. |
| `MONGO_DB_NAME` | Database name. Takes precedence over the name in `MONGO_CONN_STRING`. |
| `MONGO_USER` | Optional username for a connection string built from the host settings. |
| `MONGO_PASSWORD` | Optional password for a connection string built from the host settings. |
| `MONGO_CONN_STRING` | Optional full MongoDB URI. When set, it replaces the URI built from the host, port, user, and password settings. |

If an environment variable is absent, `migrate-mongo-config.js` also looks for the corresponding value under the current `NODE_ENV` in the Node `config` package (`host`, `port`, `database`, `username`, or `password`). This repository does not currently include config files, so the `.env` values are the starting point.

## Run migrations

Confirm that `.env` points to the intended database, then run:

```sh
npm run db:migrate
```

This runs `migrate-mongo up -f migrate-mongo-config.js`. The config uses the `migrations/` directory and records applied migrations in the `migrations_changelog` collection; it uses `migrations_changelog_lock` for migration locking.

## Current migrations

| Migration | Change |
| --- | --- |
| `20260720-01-create-application-collections.js` | Creates the application collections and indexes when missing. |
| `20260902-01-remove-public-contact-phone.js` | Removes public contact phone fields from `BaseOrg` and `ReviewObject`. |
| `20260903-01-set-registry-org-disabled.js` | Marks `BaseOrg` records disabled, then enables those whose UUID matches an `Org` with an active role. |
| `20260909-01-add-base-org-hierarchy-indexes.js` | Adds `BaseOrg` indexes on `UUID` and `oversees` when missing. |

All four migrations have intentional no-op `down` functions. In particular, the removed phone values cannot be recovered by rolling back a migration. Review the migration code and plan a database backup before running against shared or production data.
