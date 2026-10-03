# GitHub repository setup (owner/admin)

These are proposed settings for `MarioSaenz356/DASWCD-Tree-Steward-LMS`. The files in this branch do not apply repository settings automatically.

## Enable CI first

1. Review and merge the documentation/CI PR.
2. Ensure GitHub Actions is enabled under Settings > Actions > General, including permission to run GitHub-owned actions.
3. Open Actions > Frontend CI and verify a successful run on `main`. The job/check name is **Frontend checks**.
4. Then configure the required status check below. GitHub may not list a check until it has run successfully recently.

CI uses Node 24, the committed npm lockfile, `npm ci`, `npm run lint`, and `npm run build`. It has read-only repository permissions, no deployment secrets, and no path filters, so a backend-only PR still reports the required frontend check. It does not run the current placeholder test scripts.

## Protect main

In Settings > Branches, add a classic branch protection rule for exactly `main` (or use an equivalent active branch ruleset under Settings > Rules).

Recommended for our small team:

- Require a pull request before merging.
- Require **1 approving review** from another teammate.
- Dismiss stale approvals when new commits are pushed.
- Require status checks to pass: select **Frontend checks** from GitHub Actions.
- Require the branch to be up to date before merging.
- Require conversation resolution before merging.
- Apply the rule to administrators too / do not allow bypassing these settings.
- Keep force pushes and branch deletion disallowed.

Do not require deployment checks, signed commits, code-owner reviews, or test checks until the corresponding workflow is actually configured. Avoid duplicate overlapping rules. Validate the rule using a normal PR after saving.

This is a private repository. Protected branches require an eligible plan: for a personal private repository, the owner's GitHub Pro entitlement matters; for an organization, GitHub Team or Enterprise can provide private-repository protection. A collaborator's paid plan alone does not establish repository eligibility. If unavailable, keep the repo private and use the agreed PR/review process while the owner checks eligibility; this process is voluntary, not enforced protection.

[GitHub branch protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

[Required-check troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)

## Other collaboration settings

- Enable squash merging and automatically delete head branches after merge.
- Track tasks in Issues and a small project board: Backlog, In progress, In review, Done.
- Use labels such as frontend, backend, database, bug, documentation, and accessibility.
- Keep one assignee per task and request a reviewer from the relevant area.
- Agree on API contracts and record decisions before connecting frontend/backend.
- Add CODEOWNERS after the team confirms exact GitHub usernames and review responsibilities. Do not guess usernames or require code-owner approval before valid owners are configured.
- Consider Dependabot for npm and Actions updates after deciding who reviews those PRs.
- Add component/browser tests, backend CI, and a formatter in focused follow-up PRs.

## Preview hosting

The existing Netlify preview was uploaded manually. CI here does not publish it. Connect Netlify to this private GitHub repository only with an authorized owner account and the necessary repository access. If configuring continuous deployment, use base directory `frontend`, build command `npm run build`, publish directory `dist` relative to that base, and Node 24. Verify a deploy preview before replacing the existing published site. Never expose real student data in previews.

## Information needed to finish hosted settings

- Repository owner/admin access and the owner's plan eligibility.
- Team GitHub usernames and review ownership if adding CODEOWNERS.
- Netlify site ownership/access if enabling automatic previews.
