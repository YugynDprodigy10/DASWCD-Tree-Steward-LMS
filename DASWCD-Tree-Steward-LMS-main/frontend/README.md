## Database Migration

With Docker Desktop running, apply the database migration without installing PostgreSQL or Node dependencies on the host.

From the repository root:

```powershell
docker compose -f frontend/docker-compose.yml run --build --rm migrate
docker compose -f frontend/docker-compose.yml run --build --rm migrate npm run query
```

The first command applies `create_users.sql`; the second runs `queryTester.js` against the same Docker database. The npm scripts are defined under `frontend`, so `npm run migrate` by itself does not work from the repository root.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
