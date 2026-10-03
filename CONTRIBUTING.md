# Contributing

## One focused task per branch

1. Create or claim a GitHub issue with the expected behavior and acceptance criteria.
2. Start from an up-to-date `main`, with your existing work committed or otherwise safely saved.
3. Create a short branch, for example `feat/instructor-dashboard`, `fix/mobile-navigation`, or `docs/frontend-setup`.

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/instructor-dashboard
```

Keep each PR focused. Coordinate before changing shared files, database schemas, dependencies, or the API contract.

## Before a pull request

From `frontend`:

```sh
npm ci
npm run lint
npm run build
```

For UI changes, check the affected flow on a narrow phone-sized screen and desktop. Check keyboard navigation, visible focus, labels, and error/empty states. Include screenshots or a short recording and honest testing notes. Do not claim unrun tests passed.

Review the files before staging; use explicit paths to avoid unrelated changes:

```sh
git status
git diff
git add frontend/src/App.jsx
git commit -m "Add instructor module overview"
git push -u origin feat/instructor-dashboard
```

Open a PR with base `main` in GitHub. Fill out the PR template, link the issue with `Closes #123` when applicable, and request one teammate's review. Draft PRs are useful for early feedback. Resolve review threads and wait for CI before merging. Prefer squash merge, then delete the merged feature branch through GitHub.

If `main` moves while you work, commit your changes and merge the latest remote main into your branch:

```sh
git fetch origin
git merge origin/main
```

Resolve conflicts with the relevant teammate, rerun checks, and push. Do not force-push shared branches or work directly on `main`.

## Shared conventions

- Use Node 24 and npm; commit lockfile changes with dependency changes.
- Never commit `.env`, real passwords, API keys, access tokens, or real student data. Share required variable names in `.env.example` with placeholders.
- Keep database access in Node/backend code. Browser-visible `VITE_*` variables are public, not secret storage.
- Agree on request/response shapes and error handling with the backend owner before integration.
- Keep readable component boundaries and follow the existing style. Propose a formatter in a separate PR to avoid unrelated formatting changes.
- Do not commit `node_modules` or `dist`.
- Update documentation when setup or behavior changes.

## Current check limits

CI runs frontend lint/build only. The `npm test` scripts are unimplemented placeholders. Add meaningful component tests and end-to-end tests as real flows land, starting with module completion and instructor permission behavior. Backend/database CI should be added with its owner once the test setup is agreed.
