# Initial issue drafts

No remote issues were inspected or created because GitHub CLI is unavailable. These are candidate drafts, not confirmed GitHub issues. Before posting **each** draft, search open and closed issues and existing PRs, inspect current implementation, and reuse or skip work already tracked/completed. Choose one confirmed assignee; suggested owner areas are guidance, not automatic assignments. Numbers below are document headings, not GitHub issue numbers.

## Setup work already accounted for

- **Push docs/frontend-contributing:** already complete at inspection; local HEAD and the remote branch both point to `13b99c7`. Do not create an issue for this completed push. The new issue-tracking files from this task still need a commit/push.
- **Open collaboration PR:** the user reached the PR creation page, but no authenticated issue/PR listing is available to confirm submission. Search existing PRs first; if absent, open the collaboration PR directly rather than creating a redundant issue just to open it.
- Remote main was `7acbe45` at inspection and did not yet contain the collaboration commit. Check again before filing the conditional CI/merge drafts below.
- Branch protection is unverified; the supplied Settings screenshot shows the current account cannot manage repository options. Ask the owner to inspect actual rules before creating a duplicate task.

Read [the workflow](github-issues-workflow.md), [labels](github-labels.md), and [board setup](github-project-board.md). Replace dependency names with real issue links after duplicate checks. Stage actionable work in Ready only after dependencies and assignment are agreed.

## 1. Verify GitHub Actions on the collaboration PR

**Title:** Verify GitHub Actions on the collaboration PR

**User story:** As a contributor, I want verified PR checks so that broken changes are caught before merge.

**Labels:** devops, testing, high-priority

**Priority:** High

**Suggested owner area:** QA (Uziah), with repository admin (Mario)

**Acceptance criteria:**

- [ ] Find the existing collaboration PR; do not open another for the same branch.
- [ ] Confirm Frontend CI runs on the PR and inspect its logs.
- [ ] Frontend checks reports success for the current PR revision.
- [ ] Record the run link; track any failure with reproducible details.

**Dependencies / triage notes:** Existing collaboration PR. Confirm whether this is already complete before filing.

## 2. Review and merge collaboration setup PR

**Title:** Review and merge collaboration setup PR

**User story:** As a teammate, I want reviewed setup documentation and CI on main so that everyone follows the same process.

**Labels:** documentation, devops, high-priority

**Priority:** High

**Suggested owner area:** Repository admin (Mario), with a teammate reviewer

**Acceptance criteria:**

- [ ] Find the existing PR for docs/frontend-contributing.
- [ ] Review README, CI, PR template, and contribution guide; resolve comments.
- [ ] Verify required checks pass and obtain a teammate review.
- [ ] Merge when approved and confirm files exist on main.

**Dependencies / triage notes:** Successful collaboration PR checks; authorized merger. Skip if already merged.

## 3. Enable branch protection for main

**Title:** Enable branch protection for main

**User story:** As a contributor, I want main protected so that changes require review and passing checks.

**Labels:** devops, high-priority

**Priority:** High

**Suggested owner area:** Repository admin (Mario)

**Acceptance criteria:**

- [ ] Confirm repository admin access and private-repository plan eligibility.
- [ ] Require one approval, Frontend checks, and resolved conversations.
- [ ] Require current main integration; disallow force pushes and deletion and apply rules to admins where supported.
- [ ] Verify rules on a normal PR and record configuration evidence. If unavailable, document the blocker rather than mark enforcement complete.

**Dependencies / triage notes:** CI check must exist; admin and eligible plan. Follow github-setup.md.

## 4. Build instructor dashboard prototype

**Title:** Build instructor dashboard prototype

**User story:** As an instructor, I want an overview of my assigned modules so that I know which weeks I manage.

**Labels:** frontend, ui-ux, accessibility, feature, high-priority

**Priority:** High

**Suggested owner area:** Frontend/UI (Eugene)

**Acceptance criteria:**

- [ ] An instructor dashboard route exists with clearly labeled sample-role behavior until authentication is integrated.
- [ ] Assigned modules are visible and open from the dashboard.
- [ ] The rest of the course remains available read-only; student-only dashboard controls are absent.
- [ ] Desktop, mobile, and keyboard navigation work.
- [ ] ESLint and production build pass.

**Dependencies / triage notes:** Agree on instructor/module data shape with backend; real authorization tracked separately.

## 5. Build assigned-module editor

**Title:** Build assigned-module editor

**User story:** As an instructor, I want to edit my assigned module so that students receive current learning content.

**Labels:** frontend, modules, ui-ux, feature, high-priority

**Priority:** High

**Suggested owner area:** Frontend (Eugene), with API input (Mario)

**Acceptance criteria:**

- [ ] Edit module title and description; add and remove resource links.
- [ ] Save through the agreed API and verify persistence after reload.
- [ ] Assigned-module access is enforced by the server, including direct unauthorized requests.
- [ ] Loading, validation, save-success, and error states are present.
- [ ] Desktop/mobile layout and keyboard/label behavior are verified.
- [ ] Relevant checks pass.

**Dependencies / triage notes:** Instructor overview, module save API, and role/module authorization. Split a mock-only UI slice if APIs are not ready.

## 6. Implement authentication and first-login password change

**Title:** Implement authentication and first-login password change

**User story:** As a provisioned user, I want to sign in and replace my temporary password so that I can securely access the LMS.

**Labels:** auth, backend, feature, high-priority

**Priority:** High

**Suggested owner area:** Authentication/security (Clayton), frontend integration (Eugene)

**Acceptance criteria:**

- [ ] Agree on and document the authentication/session API contract.
- [ ] Valid credentials authenticate; invalid credentials receive a safe actionable error.
- [ ] New provisioned accounts must change temporary passwords before normal access.
- [ ] Logout and expired-session behavior work.
- [ ] Automated tests cover success, failure, and first-login paths.
- [ ] No credentials or tokens appear in committed files or logs.

**Dependencies / triage notes:** User schema and account provisioning agreement. No public self-registration unless requirements change.

## 7. Implement role and module authorization

**Title:** Implement role and module authorization

**User story:** As a course administrator, I want permissions enforced on the server so that users access only allowed actions and data.

**Labels:** auth, backend, modules, feature, high-priority

**Priority:** High

**Suggested owner area:** Security (Clayton), backend (Mario)

**Acceptance criteria:**

- [ ] Define a permission matrix for Student, Instructor, and Admin.
- [ ] Instructors may edit assigned modules and read the remainder of their course.
- [ ] Students cannot edit module content, change roles, or read another student’s private results.
- [ ] Admins perform explicitly permitted account and content operations.
- [ ] API tests reject unauthorized and cross-course requests; UI reflects allowed actions.

**Dependencies / triage notes:** Authentication, role data, module assignments, and course membership.

## 8. Connect student frontend to backend module APIs

**Title:** Connect student frontend to backend module APIs

**User story:** As a student, I want course content loaded from the backend so that I see the actual program material.

**Labels:** frontend, backend, modules, feature, high-priority

**Priority:** High

**Suggested owner area:** Frontend (Eugene), APIs (Mario)

**Acceptance criteria:**

- [ ] Document module list/detail response shapes and error responses.
- [ ] Replace relevant sample reads with an API service layer.
- [ ] Provide loading, empty, error, and retry behavior.
- [ ] Configure development/preview API origins without browser secrets.
- [ ] Verify module navigation with API data and handle unauthorized sessions.

**Dependencies / triage notes:** Module read endpoints and agreed auth contract.

## 9. Persist student progress

**Title:** Persist student progress

**User story:** As a student, I want my progress saved so that I can resume after signing in again.

**Labels:** frontend, backend, database, modules, feature, medium-priority

**Priority:** Medium

**Suggested owner area:** Frontend (Eugene), APIs (Mario), database (Clayton)

**Acceptance criteria:**

- [ ] Agree on a completion rule and user/module progress schema.
- [ ] Completion changes persist through the API and survive reload and a new session.
- [ ] Progress percentage, filters, and next module use saved data.
- [ ] Users cannot read or modify another user’s progress.
- [ ] Save failures are visible and do not leave false success indicators; repeat requests are safe.

**Dependencies / triage notes:** Authentication, authorization, module API, database migration.

## 10. Implement a first end-to-end quiz flow

**Title:** Implement a first end-to-end quiz flow

**User story:** As a student, I want to take a module quiz and view my result so that I can check my understanding.

**Labels:** quiz, frontend, backend, feature, high-priority

**Priority:** High

**Suggested owner area:** Quiz/API (Mario), frontend (Eugene), QA (Uziah)

**Acceptance criteria:**

- [ ] Agree on the initial question type and retry/scoring policy before implementation.
- [ ] Create one bounded vertical slice covering draft authoring, publishing, taking, submission, and result display.
- [ ] Only published quizzes are available to students; server computes scores without exposing answer keys before submission.
- [ ] Store attempts/results and enforce role/course permissions.
- [ ] Add known-answer grading tests and verify the mobile/keyboard flow.

**Dependencies / triage notes:** Auth, authorization, quiz schema and APIs. Split larger authoring/gradebook scope into linked issues.

## 11. Add instructor content upload workflow

**Title:** Add instructor content upload workflow

**User story:** As an instructor, I want to upload resources to my module so that students can access course materials.

**Labels:** frontend, backend, modules, feature, medium-priority

**Priority:** Medium

**Suggested owner area:** Frontend (Eugene), backend (Mario), security input (Clayton)

**Acceptance criteria:**

- [ ] Agree supported image/PDF/video types, limits, storage, and access rules.
- [ ] Show upload progress, success, validation, and retryable failures.
- [ ] Attach resources to the correct module and persist them.
- [ ] Server validates uploads and prevents unassigned users from modifying resources.
- [ ] Resources have descriptive labels and relevant accessibility metadata; phone use is verified.

**Dependencies / triage notes:** Module editor, upload/storage API, and authorization.

## 12. Add automated frontend behavior tests

**Title:** Add automated frontend behavior tests

**User story:** As a contributor, I want behavior tests so that changes do not break core learning flows.

**Labels:** frontend, testing, medium-priority

**Priority:** Medium

**Suggested owner area:** QA (Uziah), frontend (Eugene)

**Acceptance criteria:**

- [ ] Agree a test runner and replace the failing placeholder test script with real tests.
- [ ] Cover module opening, completion toggling, filtering, and progress/next-module updates.
- [ ] Add a browser smoke flow including keyboard navigation.
- [ ] Tests pass locally and run in CI without hiding failures or requiring production secrets.
- [ ] Document commands and use deterministic sample data.

**Dependencies / triage notes:** Coordinate runner choice and CI changes; do not write tests that merely duplicate implementation.

## 13. Add backend and authorization tests

**Title:** Add backend and authorization tests

**User story:** As a maintainer, I want backend tests so that authentication and access boundaries are verified.

**Labels:** backend, auth, testing, high-priority

**Priority:** High

**Suggested owner area:** QA (Uziah), backend (Mario), security (Clayton)

**Acceptance criteria:**

- [ ] Use an isolated test database and deterministic fixtures with documented lifecycle.
- [ ] Test authentication failures, role restrictions, module ownership, and cross-user access.
- [ ] Cover a permitted request as well as each denied path.
- [ ] Replace the backend placeholder test script and add a dedicated CI check.
- [ ] No tests use production data or credentials.

**Dependencies / triage notes:** Agreed backend test tooling, auth/permission implementation, and database test setup.

## 14. Enable automatic preview deployments

**Title:** Enable automatic preview deployments

**User story:** As a reviewer, I want a preview for frontend PRs so that I can test changes before merge.

**Labels:** devops, frontend, medium-priority

**Priority:** Medium

**Suggested owner area:** Repository admin (Mario), frontend (Eugene)

**Acceptance criteria:**

- [ ] Confirm Netlify owner access and authorize the private repository connection.
- [ ] Configure frontend base, npm run build, dist output, and Node 24.
- [ ] Verify a PR preview URL for a real branch and document how reviewers find it.
- [ ] Ensure preview contains only approved sample data and no secrets.
- [ ] Document main deployment behavior and rollback; keep current live preview until replacement is verified.

**Dependencies / triage notes:** Netlify ownership and GitHub integration permissions; separate from existing lint/build CI.

## 15. Implement class-scoped messaging

**Title:** Implement class-scoped messaging

**User story:** As a class member, I want to message my class so that I can ask questions between sessions.

**Labels:** communication, frontend, backend, feature, medium-priority

**Priority:** Medium

**Suggested owner area:** Communication/QA (Uziah), API/UI support as agreed

**Acceptance criteria:**

- [ ] Agree the initial conversation model and message API.
- [ ] Members can send/read persisted messages within their registered class.
- [ ] Server rejects access to other classes and forged sender identities.
- [ ] Loading, empty, send-failure, and retry states work on phone and desktop.
- [ ] Verify message delivery and keyboard-accessible interaction.

**Dependencies / triage notes:** Authentication, class membership, authorization, and messaging schema. TA permissions require clarification.

