# Frontend development

See the [project README](../README.md) for the project scope, Node installation, and complete React setup instructions.

From this directory, with Node 24 installed:

```sh
npm ci
npm run dev
```

`npm ci` installs React and the other dependencies. Run `npm run lint` and `npm run build` before requesting a review. The sample UI runs without Docker or a database.

## Database and backend

The database migration scripts, Docker setup, and Express API now live in `backend/`. See the [project README](../README.md) for how to run them. To apply migrations with Docker only, run from the **repository root**:

```sh
docker compose -f backend/docker-compose.yml run --build --rm migrate
docker compose -f backend/docker-compose.yml run --build --rm migrate npm run query
```