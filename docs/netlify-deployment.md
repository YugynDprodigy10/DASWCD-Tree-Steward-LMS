# Netlify full-stack deployment guide

This repository can now be built as one Netlify project: Vite serves the frontend, a Netlify Function runs the existing Express API, and Netlify Database provides managed Postgres. The API remains at `/api/...`, so the frontend can keep using same-origin requests.

## What this deployment will include

- The React/Vite site and current Express routes, including Auth0-backed login, invitations, quizzes, and gradebook routes.
- Netlify Database migrations from `netlify/database/migrations/`.
- Git-based deploy previews for pull requests and production deploys from `main`, after the project is connected to GitHub.

Learning-material PDFs and videos are **not** shared or permanently saved by this deployment yet. The current browser-only demo storage is not a shared file service, and the authenticated materials API is disabled because the backend upload endpoints do not exist. Keep `VITE_MATERIALS_API_ENABLED=false`. When file uploads are implemented, store file bytes in S3 (or another object store) and keep file metadata in Postgres. That is more suitable for video and larger uploads than sending the files through a serverless API request.

## Before connecting production

1. Rotate the Auth0 Management API secret that was accidentally shown in a screenshot. Do not commit or send the replacement secret in chat. Enter it only in Netlify's secret environment-variable form.
2. Confirm you can edit the existing Netlify project and connect it to the GitHub repository. The project owner/team may need to approve GitHub access.
3. Confirm the Netlify team is on a credit-based plan that offers Netlify Database. On the current Free plan, the monthly allowance is 300 credits and has a hard limit. Production deployments, Functions, database compute, database bandwidth, and site traffic can all use credits. Netlify Database on Free is limited to one compute unit, 48 compute units per billing period, 5 GB written, 5 GB bandwidth, and 5 GB maximum size per database. Check the team's billing page before treating it as a production service.
4. Confirm the project is okay to use a new, empty Netlify database. Do not run the first migration against any existing database until the team has checked its data and schema.

Netlify Database is available only on credit-based plans. It can apply versioned SQL files from this repository as part of deployment. Learn about current costs and limits in [Netlify's database billing documentation](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/).

## Connect the GitHub repository

1. Open the existing Netlify project (`elegant-fox-d4ee0f`) and open its continuous-deployment/build settings.
2. Choose **Link repository** (or **Change repository**) and authorize the GitHub repository `MarioSaenz356/DASWCD-Tree-Steward-LMS` if asked.
3. Set the production branch to `main`.
4. Keep the base directory at the repository root. Do not set it to `frontend`; `netlify.toml` at the repository root configures both the website and API Function.
5. Use the build settings from `netlify.toml`: build command `npm --prefix backend ci && npm --prefix frontend ci && npm --prefix frontend run build`, publish directory `frontend/dist`.
6. Save the connection. Netlify should build a deploy preview for a pull request and a production deploy after a change is merged into `main`.

Do not change the existing production site to this branch until the pull request passes review and checks. The first production deploy also applies the initial database migrations.

## Create and check the database

1. In the Netlify project, open **Data & storage → Database** and create a new Postgres database in a region near the Functions region.
2. Netlify uses the numbered SQL files in `netlify/database/migrations/` as the schema history. The first production deploy applies them to the production database; deploy previews get their own database branches when the plan supports them.
3. After the first deploy, check the deploy log for successful migrations and open `/api/health` on the deployed site. A successful response includes `ok: true` and a database timestamp.
4. Never run the initial schema against a database that contains records you need to keep. Make a backup first and have a teammate review any migration that changes or removes data.

## Add Auth0 settings in Netlify

Open **Project configuration → Environment variables** and add these values for both production and deploy previews. Add secrets through the dashboard; do not put them in `netlify.toml`, `.env.example`, or GitHub.

| Variable | Value |
| --- | --- |
| `VITE_AUTH0_DOMAIN` | The Auth0 tenant domain, without `https://` |
| `VITE_AUTH0_CLIENT_ID` | The Auth0 single-page application client ID |
| `VITE_AUTH0_AUDIENCE` | The API audience configured for the LMS |
| `VITE_ENABLE_TEST_LOGIN` | `false` |
| `VITE_MATERIALS_API_ENABLED` | `false` until shared upload endpoints and object storage are implemented |
| `AUTH0_DOMAIN` | Same Auth0 tenant domain |
| `AUTH0_AUDIENCE` | Same LMS API audience |
| `AUTH0_SPA_CLIENT_ID` | Same single-page application client ID |
| `AUTH0_DATABASE_CONNECTION` | Auth0 database connection name used for invitations |
| `AUTH0_MGMT_CLIENT_ID` | Auth0 machine-to-machine application's client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | A newly rotated Auth0 Management API secret |
| `ENABLE_TEST_LOGIN` | `false` |

In Auth0, add the Netlify production URL to the SPA application's **Allowed Callback URLs**, **Allowed Logout URLs**, and **Allowed Web Origins**. Also add the exact Deploy Preview URL when testing sign-in on a preview. Keep local development URLs only if you still need them. Never enable test login on the public production site.

After changing environment variables, trigger a new deploy; build-time `VITE_` variables are included in the frontend bundle when it is built.

## Where uploads will live

Postgres stores small structured records (users, module data, quiz results, and file metadata), not the PDF/video bytes. The recommended next step is an S3 bucket with private objects and short-lived signed upload/download URLs. The browser can upload directly to S3, while the API checks the user's role and saves the metadata in Postgres. This avoids sending large video files through a Netlify Function. Until those endpoints, bucket permissions, and Auth0 checks are implemented, uploads are prototype-only and are not available to all signed-in users.

## Beginner-friendly deployment model

- **GitHub is the source of truth.** A pull request is a proposed set of changes; merging it into `main` tells Netlify to build and publish that version.
- **Netlify builds the website and runs the API.** The API runs only when a request arrives, as a Function, instead of a server that stays on all day.
- **The database keeps application records.** The `NETLIFY_DB_URL` value is supplied by Netlify Database to the backend at runtime; do not copy it into source control.
- **Environment variables are settings outside the code.** Public Auth0 client settings are prefixed `VITE_`; Management API credentials and database URLs are server-only secrets.
- **Files use object storage.** S3 holds the actual PDF/video bytes; Postgres keeps their names, module association, and permissions.

## Rollback

In Netlify's deploy history, republish the last known-good deploy if a release fails. A code rollback does not automatically undo a database migration. Migrations must be written to be compatible with both the old and new application version, and the team should take/verify a database backup before a risky schema change.
