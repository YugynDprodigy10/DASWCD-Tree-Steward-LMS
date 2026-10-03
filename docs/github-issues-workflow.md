# GitHub Issues and sprint workflow

This guide covers planning and tracking only. Use [CONTRIBUTING.md](../CONTRIBUTING.md) for Git commands and code-review conventions, and [github-setup.md](github-setup.md) for CI and branch protection.

## Start with an issue

Every meaningful feature, bug, UX change, or technical task should have a GitHub Issue. Search open **and closed** issues and related PRs before creating one; update an existing item instead of duplicating it. Use the structured forms once they are merged into the default branch.

Every issue should have one accountable assignee, acceptance criteria, appropriate area/type labels, and exactly one priority label. A newly submitted issue may be briefly unassigned during triage; it must have a confirmed assignee before Ready. Do not infer GitHub usernames from names or assign people without confirmed responsibilities.

The forms collect area and priority as text selections; they do not automatically set matching labels, assign teammates, add a sprint, or create a Project card. During triage, apply these using [the label guide](github-labels.md) and [board guide](github-project-board.md).

## Status flow

**Backlog → Ready → In Progress → Review → Done**

| Status | Meaning and exit condition |
| --- | --- |
| Backlog | Captured work, prioritized during triage. Clarify the problem, scope, criteria, and dependencies. |
| Ready | Small enough to complete, assigned, labeled, criteria agreed, and blockers resolved. Ready does not mean someone has started. |
| In Progress | Assignee is implementing on a short-lived branch. Link the branch or draft PR and keep blockers current. |
| Review | PR is ready for review; implementation and evidence are available. Address feedback and passing checks before merging. Move back to In Progress if substantial rework is needed. |
| Done | Acceptance criteria and Definition of Done are satisfied, the PR is merged, and the linked issue is closed as completed. For administration-only work, record evidence that the setting was applied and verified instead of requiring a code PR. |

Keep blocked work in its current status, add `blocked`, and record the dependency, person/action needed, and next follow-up. Remove the label when resolved. Close duplicates or cancelled work as not planned with an explanation; do not count them as delivered sprint work.

## Branches and pull requests

Create a short-lived branch from current `main`, including the actual issue number where practical:

```text
feat/12-instructor-dashboard
feat/13-module-editor
feat/14-auth-login
fix/18-module-progress
test/22-auth-tests
docs/25-update-api-docs
chore/30-preview-deployment
```

These numbers are examples, not issues already created. Link a PR to its issue using `Closes #12` in the PR description. Use `Refs #12` when a PR completes only part of the issue. A closing keyword closes the issue when its PR merges into the default branch; verify remaining acceptance criteria first.

GitHub Actions must pass and another teammate should review before merge. Delete feature branches after merging unless still needed. Do not push directly to `main` once protection is enabled; use the PR process now too. If protection is unavailable, this is a team convention rather than an enforced restriction.

## Acceptance criteria versus Definition of Done

Acceptance criteria describe the observable outcomes for a **specific issue**. Definition of Done describes the shared quality bar: agreed criteria met, relevant tests/checks passed, review completed, documentation updated where needed, no secrets or real student data exposed, and integration limitations explicitly documented. For UI work include phone/desktop and keyboard checks. A draft or mock UI must be labeled as such; frontend-only checks do not prove server authorization.

### Example: Build instructor dashboard

- [ ] Instructor dashboard route exists.
- [ ] Instructor can see assigned modules and open one.
- [ ] Student-only controls do not appear on the instructor dashboard.
- [ ] Read-only access to the rest of the course remains available.
- [ ] Layout works on desktop and mobile.
- [ ] Keyboard navigation and visible focus work.
- [ ] ESLint and production build pass.

A prototype can use sample assignments, but its issue must explicitly say that login and server enforcement are separate dependencies.

### Example: Build assigned-module editor

- [ ] Instructor can edit the title and description.
- [ ] Instructor can add resources/links and save changes.
- [ ] Instructor cannot edit modules they are not assigned to.
- [ ] Loading, validation, save-success, and error states exist.
- [ ] Responsive layout, labels, keyboard access, and focus are verified.
- [ ] Relevant automated checks pass.

For integrated completion, verify unauthorized API requests are rejected, and saved changes survive a reload. A demo save in React state does not meet persistent-save or authorization criteria.

## Sprint rhythm

Use a two-week sprint as a starting proposal; confirm dates/capacity with the team. At planning, select Ready issues, set Sprint and Priority, identify dependencies, and avoid assigning more work than the team can finish. Prefer one active implementation issue per person.

During the sprint, update the board when work changes state and leave brief progress/blocker notes on the issue. Reviewers should check Review regularly. At sprint end, demo accepted outcomes, close completed issues, explicitly move unfinished work into a later sprint, and record one improvement for the next sprint. Do not mark work Done just because the sprint ended.

## Responsibility guidance

| Person | Suggested area (confirm assignments in GitHub) |
| --- | --- |
| Eugene | Frontend, UI, accessibility, responsive design |
| Mario | Backend, quiz logic, APIs, repository administration |
| Clayton | Database, authentication, security |
| Uziah | Communication features and QA |

No GitHub usernames or automatic assignees are configured. Cross-area issues need one accountable assignee and input from the other relevant owners.

## Setup resources

- [Label names and descriptions](github-labels.md)
- [Project board setup](github-project-board.md)
- [Ready-to-copy initial issues](initial-issues.md)

References: [GitHub issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms), [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects).
