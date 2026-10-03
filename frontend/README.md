# Frontend development

See the [project README](../README.md) for the project scope, Node installation, and complete React setup instructions.

From this directory, with Node 24 installed:

```sh
npm ci
npm run dev
```

`npm ci` installs React and the other dependencies. Run `npm run lint` and `npm run build` before requesting a review. The sample UI runs without Docker or a database.

## Database migration (optional; database work only)

The existing migration utilities are Node scripts, not React code. Do not import them into browser components.

With Docker Desktop running, apply the database migration without installing PostgreSQL or Node dependencies on the host. From the **repository root**:

```sh
docker compose -f frontend/docker-compose.yml run --build --rm migrate
docker compose -f frontend/docker-compose.yml run --build --rm migrate npm run query
```

The first command applies `create_users.sql`; the second runs the query examples against the same Docker database. Coordinate migration changes with the database owner. Development database credentials are for local use only.

The npm migration scripts are defined in `frontend/package.json`; running `npm run migrate` from the repository root will not work.
