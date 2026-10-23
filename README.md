# Steward Tree LMS

Steward Tree is a learning management system for the Doña Ana Soil and Water Conservation District (DASWCD). We are building a simple, mobile-friendly learning space for its recurring 12-week Tree Steward program, including volunteers with limited technical experience.

## What we are building

- **Students:** read weekly modules, access learning materials, submit assignments, take quizzes, view grades, and communicate with their class.
- **Instructors:** view the course, edit their assigned modules, add text and media, build quizzes with draft/publish steps, and review student results.
- **Admins:** manage accounts, roles, module assignments, and course content across program offerings.

The backend must enforce permissions; hiding a button in React is not access control.

## Current status

The React prototype includes Auth0 sign-in, student and instructor demo views, a responsive card layout, and navigation across 12 sample modules. Auth0 access tokens are verified by the API; verified Auth0 emails are linked to pre-provisioned LMS accounts and their database roles. Quiz API requests use those verified identities rather than browser-supplied user IDs. Configure an Auth0 tenant and API as described below. The local demo buttons remain separate and are not authenticated. Persistent course content, enrollment, overall grades, admin tools, and messaging are not connected.

[View the shared frontend preview](https://elegant-fox-d4ee0f.netlify.app). This is currently a manual deployment and may lag behind this repository.

## Install prerequisites

- **Node.js 24 LTS**, including npm: [official installer](https://nodejs.org/en/download).
- **Git:** [official downloads](https://git-scm.com/downloads).
- A browser and an editor such as VS Code.
- Access to this private repository: accept the owner's GitHub invitation first.

On Windows, you can install Node from PowerShell:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget
```

Restart your terminal/editor afterward, then check:

```sh
node --version
npm --version
git --version
```

Use Node 24 for consistency with CI. If Windows still finds an old version, run `where.exe node` and `where.exe npm` to find competing installations. If you use a Node version manager, select Node 24 through that manager.

## Run the frontend

### Configure Auth0

In Auth0, create a **Single Page Application** and an **API**. Set the API identifier to the audience you will use below, enable RS256 signing, and allow `http://localhost:5173` for the SPA's callback URL, logout URL, and web origin.

The API access token must contain the user's verified email. Create and deploy a **Post Login** Auth0 Action in the login flow with:

```js
exports.onExecutePostLogin = async (event, api) => {
  if (event.user.email) {
    api.accessToken.setCustomClaim("https://stewardtree.app/claims/email", event.user.email);
  }
  api.accessToken.setCustomClaim(
    "https://stewardtree.app/claims/email_verified",
    event.user.email_verified === true,
  );
};
```

Copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to `backend/.env`. Set the Auth0 domain, SPA client ID, and the same API audience in both files. These local files are ignored by Git; do not commit secrets. Vite reads its local settings when it starts, so restart the frontend after changing them.

An LMS user must already exist in the database with the same email address and an assigned student, teacher, or administrator role. On their first successful sign-in, the API requires Auth0 to mark the email verified and permanently links that Auth0 subject to the LMS user. Unknown emails are denied; create/provision LMS accounts through the database workflow before granting access. Auth0 manages passwords and password resets.

The migration leaves the legacy `passwordTemp` column and existing values in place temporarily for compatibility, but the application no longer reads or writes it. Do not use or add passwords there; arrange a separate cleanup once any needed legacy data has been reviewed.

For a new checkout:

```sh
git clone https://github.com/MarioSaenz356/DASWCD-Tree-Steward-LMS.git
cd DASWCD-Tree-Steward-LMS/frontend
npm ci
npm run dev
```

**React is installed by `npm ci`**, together with React DOM, Vite, and the other dependencies declared in `frontend/package.json`. Do not install React globally or run `create-vite` inside this existing repository.

If you already have the repository, the frontend runs on its own:

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Leave the terminal running; edits update the page automatically. Press Ctrl+C to stop it. The sample frontend works without Docker or the backend.

### Run the backend (required for Auth0 accounts; optional for local demos)

To connect the frontend to the API and database, start Docker Desktop, then open a **second terminal** in the repository root and run:

```sh
cd backend
npm ci
npm run migrate
npm run dev
```

Check `http://localhost:3000/api/health`; it should return the database's current time. With both terminals running, the login page footer shows the same database time, which confirms the frontend, backend, and database are connected.

The Docker database is published on host port `5434` by default because a local PostgreSQL service may already use `5432`. PostgreSQL still listens on `5432` inside the container. The local API uses `DB_HOST_PORT` (or `DB_PORT`) to connect to the published host port. If you need another host port, set `DB_HOST_PORT` before running Docker Compose; the migration script automatically finds an available host port when it starts the database.

To create sample LMS users, run `npm run query` in `backend`, then create Auth0 users with the matching verified emails `teststudent1@example.com`, `testteacher1@example.com`, or `testadmin1@example.com`. The sample database rows provide roles; passwords are managed by Auth0.

## Try the interface

### Administrator and account-recovery preview

Choose **Administrator demo** on the login screen to explore the single-class admin workspace. It includes an overview, a searchable People directory, role/module assignments, invitations, and illustrative student progress.

- **Invite person** creates a sample pending invitation. Duplicate account/pending-invitation emails are rejected without regard to capitalization.
- In **Invitations**, copy a clearly labeled sample link, preview sending/acceptance, revoke, or renew expired/revoked invitations. Completing sample acceptance adds the person to the local directory.
- In **People**, change an email while retaining the same account and progress, add a sample person, assign student/instructor/administrator roles with confirmation for administrator access, remove/restore people, request a sample password reset, or deactivate/reactivate an account.
- In **Modules**, add/edit module details, independently toggle student and instructor visibility, preview each audience catalog, and select active assigned instructors. New modules start hidden from both audiences. Inactive instructors retain their assignments but are not displayed as active module instructors.
- Auth0 handles real sign-in and password recovery. The administrator demo's account-management examples remain local sample data only.

These workflows use in-memory sample data and reset on refresh or sign out. They do not send email, generate usable invitation/reset links, authenticate users, or modify real accounts. The existing API health check remains separate. Backend integration must provide invitation/reset token validation and expiration, authenticated role enforcement, and email updates tied to stable user IDs. Module visibility currently affects the admin catalog preview, not the separate student/instructor demo routes. Multiple simultaneous classes are outside this preview.

### Student and instructor preview

Choose **Student demo** or **Instructor demo** on the login screen; no credentials are needed. These are local previews and do not authenticate with Auth0 or the API.

- In the instructor demo, add a block in Week 2. Leave **Visible in student demo** unchecked to create a draft.
- Select **Preview as student** to confirm that drafts and editing controls disappear. Use **Exit preview** to return.
- Use the module selector or previous/next buttons to explore the course. Other modules are read-only in the instructor demo.
- On a phone, navigation moves to the bottom; student preview remains available above the module heading.

## Check and build

Run from `frontend`:

```sh
npm run lint
npm run build
npm run preview
```

- `lint`: checks JavaScript and React code with ESLint.
- `build`: creates the deployable site in `frontend/dist`.
- `preview`: serves the production build locally; open its printed URL.

Use `npm ci` after cloning or pulling lockfile changes. Use `npm install <package>` only when intentionally adding a dependency, and commit both package files. For frontend quiz/auth adapter tests, run `node --test test/quiz.test.js` from `frontend`. Backend API tests run with `npm test` from `backend` after starting the database and applying migrations.

## Repository layout

```text
.github/                CI workflow and pull request template
backend/                Express API prototype
frontend/
  src/                  React UI and existing Node database utilities
  public/               Static assets
  databaseInstructions/ SQL migrations and query examples
  docker-compose.yml    Local database/migration setup
  package.json          Frontend commands and dependencies
docs/                   GitHub administration guide
```

The database utilities currently live under `frontend/src`; they run in Node and must never be imported into browser components. Moving them into the backend is a follow-up task to coordinate with the database owner.

## Backend and database

See [frontend setup and database commands](frontend/README.md) for the existing Docker migration workflow. The backend's `/api/health` endpoint queries PostgreSQL, so it needs a running database and matching connection settings. Full-stack setup is separate from the frontend quick start above.

## Collaboration and CI

Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting a branch. Open a pull request into `main`, use the provided template, and request a teammate's review.

The **Frontend CI** workflow runs dependency installation, ESLint, and the production build for every PR targeting `main` and every push to `main`. It checks the frontend and its Node utilities; it does not yet test the backend or database, and it does not deploy to Netlify.

Repository admins should follow [GitHub setup](docs/github-setup.md) to enable branch protection. Adding a workflow file alone does not prevent direct pushes or failed merges.

## Built-in quizzes

Google Forms links have been replaced with a native multiple-choice builder. In Instructor demo, open Create → Quiz or use the Quizzes section in a module. Create a draft, add questions with 2–6 choices and exactly one correct answer, assign 1–100 points, and publish. Published questions are read-only until unpublished; the API rejects question changes after submissions.

Student quiz titles open a separate tab/window (browser preferences decide which). Radio-button groups support keyboard navigation, unanswered questions block submission, and successful submissions show the score. Instructor previews never submit attempts. Quiz windows expire after two hours; signing out invalidates their launch context.

Demo quizzes use browser-local storage and local practice scoring; they are cleared on sign-out. They are not official grades. Signed-in accounts use the quiz API without falling back to sample data. Run the backend and migrations before using signed-in quiz flows. The API validates Auth0 access tokens and derives each request's identity and roles from the database; it does not trust a user ID supplied by the browser. The API decides module permissions; live accounts are not hardcoded to Week 2 for quiz operations.

Final exams with written answers remain disabled until the backend supports them. Weighted course grades and retake/answer-release policy are separate work. Native quiz questions are no longer edited through the announcement/material dialog.

Validation: `node --test frontend/test/quiz.test.js`, frontend lint/build, and browser checks for draft creation, required correct answer, publication, student visibility, separate-window launch, preview-only completion, required student answers, and demo scoring. The HTTP adapter tests mock responses; they do not constitute a live database integration test.

### Integration verification (2026-10-16)

After merging main, both migrations and the seed queries ran successfully on an isolated local PostgreSQL 14 cluster without Docker. All 9 backend API tests, 2 frontend adapter/validation tests, frontend lint, and the production build passed. The browser flow verified development instructor login, draft/question creation, publishing, student login, opening a quiz in a separate window, and a submitted server score matching the persisted database record. Docker/PostgreSQL 18 remains unverified. Auth0 tenant setup and deployment configuration must be completed before enabling real accounts.
