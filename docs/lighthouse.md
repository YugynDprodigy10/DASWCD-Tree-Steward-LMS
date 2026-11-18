# Lighthouse checks

[Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) audits a page for performance, accessibility, best practices, and SEO, and scores each category from 0 to 100. We run it with Lighthouse CI (`@lhci/cli`) against the production build, both locally and on every pull request.

## What is audited

Lighthouse CI serves the built `frontend/dist` folder and audits it 3 times with mobile settings, then uses the median run. Settings are in `frontend/lighthouserc.json`.

- Only the login page is audited. Other screens require signing in or clicking through a demo.
- The static server has no API behind it, so anything that calls `/api` fails during the audit (see [Expected findings](#expected-findings-not-bugs)).
- Score targets are 90 in every category. They are warnings only, so a lower score does not fail the build yet.

## Run it locally

Run from `frontend`. Build first: Lighthouse audits whatever is already in `dist`, so skipping the build tests an old version.

```sh
npm run build
npm run lighthouse
```

Reports are saved to `frontend/lighthouse-reports/` as HTML and JSON. Open an `.html` file in a browser to read it. Both `lighthouse-reports/` and `.lighthouseci/` are ignored by git.

Lighthouse needs Chrome or another Chromium browser. If Chrome is not installed, point it at Microsoft Edge for that terminal session. In PowerShell:

```powershell
$env:CHROME_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"; npm run lighthouse
```

Do not add `CHROME_PATH` to `package.json`, `lighthouserc.json`, or the workflow. It is specific to your machine, and CI finds Chrome automatically.

The `GitHub token not set` warning in the output is expected. That token is only for posting status checks from an LHCI server, which we do not use.

### Manual audit in the browser

For a quick one-off check, run `npm run build` and `npm run preview`, open the printed URL in a Chrome or Edge private window (extensions skew results), then open DevTools (F12), select **Lighthouse**, choose **Mobile**, and select **Analyze page load**. Firefox does not include Lighthouse.

## In CI

The **Lighthouse** job in the **CI** workflow (`.github/workflows/ci.yml`) runs Lighthouse after the build on every pull request to `main`, on pushes to `main`, and on manual runs.

- Scores: open the workflow run and expand the **Lighthouse** step.
- Full reports: download **lighthouse-reports** under **Artifacts** at the bottom of the run summary. They are uploaded even if an earlier step fails.

CI runs on shared GitHub machines, so its Performance score can be a few points lower than a local run. Treat the CI result as the reference, since every pull request is measured the same way.

## Baseline

Measured 2026-10-23 on `ci/lighthouse` after merging `main`. Lighthouse 12.6.1, Edge 156, mobile settings, median of 3 runs.

| Performance | Accessibility | Best Practices | SEO |
| ----------- | ------------- | -------------- | --- |
| 100         | 95            | 93             | 100 |

Update this table when the scores change meaningfully, with the date and what changed.

## Known findings

These are real issues on the login page:

- **Color contrast (accessibility).** Muted green text is below the required 4.5:1 contrast ratio: the brand tagline (`.brand small`, 3.75), the login footer (`.login-footer`, 3.69; `.login-footer .subtle`, 4.48), the intro paragraph (`.login-story p`, 4.08), `.eyebrow` (4.44), `.login-help` (4.15), and `.demo-section p` (4.21). Darkening the shared muted text color would likely fix most of them.
- **Small text (best practices).** Lighthouse expects at least 12px. Currently `.brand small` is 8px, `.demo-label` 9px, `.eyebrow` 10px, and `.demo-section p`, `.login-footer`, and `.login-help` are 11px. This matters for our volunteers, and small text is also where the contrast problems are.

Track fixes in GitHub issues and update this list when they are resolved.

## Expected findings (not bugs)

- **Browser errors logged to the console.** The audit server returns 404 for `/api/health` (the login page's connection status) and `/favicon.ico` (requested automatically by the browser). Both come from auditing static files without the backend.
- **Server settings.** If Lighthouse reports missing text compression or cache headers, those come from the local static server, not our code. They are worth checking again once the app is deployed.

## Dependency audit warnings

`npm audit` reports issues in dependencies of `@lhci/cli`. It is a dev-only tool, already the latest version (0.15.1), and `npm audit --omit=dev` reports 0 vulnerabilities. npm's suggested fix is downgrading to `@lhci/cli@0.1.0`, so do not run `npm audit fix --force`.

## Raising the bar

Once accessibility scores stay at or above 90, change its assertion in `frontend/lighthouserc.json` from `"warn"` to `"error"` so a pull request that lowers it fails CI. Do the same for other categories when they are stable. After deployment, consider adding the deployed URL so Lighthouse also measures the real server, HTTPS, and network.
