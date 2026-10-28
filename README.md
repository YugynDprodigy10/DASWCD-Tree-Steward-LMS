# Steward Tree LMS

Steward Tree is a learning management system for the Doña Ana Soil and Water Conservation District (DASWCD). We are building a simple, mobile-friendly learning space for its recurring 12-week Tree Steward program, including volunteers with limited technical experience.

## What we are building

- **Students:** read weekly modules, access learning materials, submit assignments, take quizzes, view grades, and communicate with their class.
- **Instructors:** view the course, edit their assigned modules, add text and media, build quizzes with draft/publish steps, and review student results.
- **Admins:** manage accounts, roles, module assignments, and course content across program offerings.

The backend must enforce permissions; hiding a button in React is not access control.

## Current status

The React app supports Auth0 sign-in and local-only buttons for the three seeded LMS test accounts. The API verifies Auth0 access tokens and saves each Auth0 subject in `users.auth0Sub`; the database's numeric `userID` remains the LMS foreign key. Verified email is used only to link an Auth0 subject to a pre-provisioned LMS account the first time. Local test-account buttons instead use the selected seeded database row and are hard-disabled outside local development. Quiz API requests use signed bearer tokens, never browser-supplied user IDs. Persistent course content, enrollment, overall grades, most admin tools, and messaging are not connected.

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

In Auth0, create a **Single Page Application** and an **API**. Set the API identifier to the audience you will use below, enable RS256 signing, and allow `http://localhost:5173` for the SPA's callback URL, logout URL, and web origin. Enable **Allow Refresh Token Rotation** in the SPA's settings. In the API settings, enable **Allow Offline Access** so the SPA can request refresh tokens.

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

Copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to `backend/.env`. Set the Auth0 domain, SPA client ID, and the same API audience in both files. The domain, SPA client ID, and audience are public identifiers for a browser app; they are not secrets. Never put an Auth0 client secret, Management API secret, or other credential in a `VITE_` variable or frontend file. The local env files are ignored by Git. Vite reads its settings when it starts, so restart the frontend after changing them.

The SPA caches Auth0 tokens in local storage and uses refresh-token rotation to restore the login after a reload and renew access tokens. This improves session persistence when browser privacy settings block silent authentication, but local-storage tokens are accessible to JavaScript on the origin; keep dependencies updated and prevent cross-site scripting. Refresh tokens expire according to the Auth0 application policy, so users may eventually need to sign in again.

An LMS user must already exist in the database with the same email address and an assigned student, teacher, or administrator role. On first Auth0 sign-in, the API requires Auth0 to mark the email verified and permanently stores the token subject (Auth0 user ID) in `users.auth0Sub`; later requests look up that stable ID rather than matching email again. The numeric `users.userID` remains the LMS identifier referenced by quiz and enrollment tables. Unknown emails are denied; create/provision LMS accounts through the database workflow before granting access. Auth0 manages passwords and password resets.

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

### Run the backend (required for Auth0 and local test accounts)

To connect the frontend to the API and database, start Docker Desktop, then open a **second terminal** in the repository root and run:

```sh
cd backend
npm ci
npm run migrate
npm run dev
```

Check `http://localhost:3000/api/health`; it should return the database's current time. With both terminals running, the login page footer shows the same database time, which confirms the frontend, backend, and database are connected.

The Docker database is published on host port `5434` by default because a local PostgreSQL service may already use `5432`. PostgreSQL still listens on `5432` inside the container. The local API uses `DB_HOST_PORT` (or `DB_PORT`) to connect to the published host port. If you need another host port, set `DB_HOST_PORT` before running Docker Compose; the migration script automatically finds an available host port when it starts the database.

To create the sample LMS rows, run `npm run query` in `backend`. The **Test student**, **Test instructor**, and **Test administrator** buttons use those database accounts directly and do not require Auth0. To exercise Auth0 instead, create Auth0 users with matching verified emails `teststudent1@example.com`, `testteacher1@example.com`, or `testadmin1@example.com`; their LMS roles still come from the database, and their passwords are managed by Auth0.

For local test-account buttons only, set `ENABLE_TEST_LOGIN=true` in `backend/.env` and `VITE_ENABLE_TEST_LOGIN=true` in `frontend/.env.local`, then restart both servers. These endpoints issue two-hour local test tokens signed with a random key that exists only in backend memory, accept requests only from loopback, and are disabled when `NODE_ENV=production`. Test tokens stay in app memory, except for a short-lived launch record when opening a quiz in another tab. The buttons are not a production login method; leave both flags false for deployments. Local test tokens become invalid when the backend restarts.

### Auth0 email capabilities

Auth0 can send verification and password-reset emails for database-connection users through Universal Login. Configure an email provider under **Branding → Email Provider** (dashboard wording may vary). The built-in provider is for development only; production delivery requires an external SMTP/email provider such as Amazon SES, SendGrid, or another supported service. Auth0 also supports invitation workflows based on password-change tickets, but the LMS's current invitation screens are local previews and do not send invitations. A real invite feature needs a backend integration with Auth0's Management API/email workflow; never put a Management API client secret in the React app.

## Try the interface

### Administrator and account-recovery preview

Choose **Test administrator** to enter the administrator workspace using the seeded LMS account. The admin people, invitation, module, and progress screens are still illustrative local data, not connected to real admin APIs.

- **Invite person** creates a sample pending invitation. Duplicate account/pending-invitation emails are rejected without regard to capitalization.
- In **Invitations**, copy a clearly labeled sample link, preview sending/acceptance, revoke, or renew expired/revoked invitations. Completing sample acceptance adds the person to the local directory.
- In **People**, change an email while retaining the same account and progress, add a sample person, assign student/instructor/administrator roles with confirmation for administrator access, remove/restore people, request a sample password reset, or deactivate/reactivate an account.
- In **Modules**, add/edit module details, independently toggle student and instructor visibility, preview each audience catalog, and select active assigned instructors. New modules start hidden from both audiences. Inactive instructors retain their assignments but are not displayed as active module instructors.
- Auth0 handles real sign-in and password recovery. The administrator demo's account-management examples remain local sample data only.

These workflows use in-memory sample data and reset on refresh or sign out. They do not send email, generate usable invitation/reset links, or modify real accounts. Auth0 handles authentication for Auth0 users; the local test administrator button is only for local development. The existing API health check remains separate. Backend integration must provide invitation/reset token validation and expiration, authenticated admin API operations, and email updates tied to stable user IDs. Module visibility currently affects the admin catalog preview, not the separate student/instructor course pages. Multiple simultaneous classes are outside this preview.

### Student and instructor preview

Choose **Test student** or **Test instructor** on the login screen to use the seeded database accounts; no password or Auth0 account is needed when local test login is enabled. These requests use the real local LMS rows and quiz API, while the announcement and learning-material cards remain sample content.

- As the test instructor, add a block in Week 2. Leave **Visible in student demo** unchecked to create a draft.
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

Google Forms links have been replaced with a native multiple-choice builder. As the test instructor, open Create → Quiz or use the Quizzes section in a module. Create a draft, add questions with 2–6 choices and exactly one correct answer, assign 1–100 points, and publish. Published questions are read-only until unpublished; the API rejects question changes after submissions.

Student quiz titles open a separate tab/window (browser preferences decide which). Radio-button groups support keyboard navigation, unanswered questions block submission, and successful submissions show the score. Instructor previews never submit attempts. Quiz windows expire after two hours; signing out invalidates their launch context.

Demo quizzes use browser-local storage and local practice scoring; they are cleared on sign-out. They are not official grades. Signed-in accounts use the quiz API without falling back to sample data. Run the backend and migrations before using signed-in quiz flows. The API validates Auth0 access tokens and derives each request's identity and roles from the database; it does not trust a user ID supplied by the browser. The API decides module permissions; live accounts are not hardcoded to Week 2 for quiz operations.

Final exams with written answers remain disabled until the backend supports them. Weighted course grades and retake/answer-release policy are separate work. Native quiz questions are no longer edited through the announcement/material dialog.

Validation: `node --test frontend/test/quiz.test.js`, frontend lint/build, and browser checks for draft creation, required correct answer, publication, student visibility, separate-window launch, preview-only completion, required student answers, and demo scoring. The HTTP adapter tests mock responses; they do not constitute a live database integration test.

### Integration verification (2026-10-16)

After merging main, both migrations and the seed queries ran successfully on an isolated local PostgreSQL 14 cluster without Docker. All 9 backend API tests, 2 frontend adapter/validation tests, frontend lint, and the production build passed. The browser flow verified development instructor login, draft/question creation, publishing, student login, opening a quiz in a separate window, and a submitted server score matching the persisted database record. Docker/PostgreSQL 18 remains unverified. Auth0 tenant setup and deployment configuration must be completed before enabling real accounts.
