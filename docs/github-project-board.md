# Tree Steward LMS Development project board

## Current status

No remote project was inspected, created, or modified. GitHub CLI/Projects API access is unavailable here. Use the following manual setup and search existing projects first to avoid duplicates.

## Find or create the project

1. Check the repository's Projects tab and the owner's user/organization Projects for a similar active board. Reuse it if appropriate and preserve its existing items, fields, views, and workflows.
2. If none exists, have an authorized owner create a GitHub Project named **Tree Steward LMS Development** with a Board view. Use the team organization if one exists; otherwise use the repository owner's account.
3. Keep the project private for this private repository. Give confirmed team members suitable project access; repository access and project access are separate. Do not make the repository public to enable project features.
4. Link the project to the repository from its Projects tab. This improves discovery; linking alone does not import or auto-add issues.

## Fields and views

Edit the existing **Status** field rather than adding another status field. Use exactly:

- Backlog
- Ready
- In Progress
- Review
- Done

If reusing a board, agree on mappings for old statuses before changing options and preserve existing item status assignments.

Use built-in Assignees and Labels. Add or reuse **Priority** (High, Medium, Low) and **Sprint** (iteration; propose two-week iterations and agree on the start date). An optional Area field can help reporting but should not duplicate area labels without a reason.

Save these views:

- **Team board:** Board grouped by Status.
- **Backlog:** Table filtered to Backlog and Ready, with assignee, priority, labels, and sprint columns.
- **Current sprint:** Board filtered to the active Sprint iteration, grouped by Status.

Add actual repository issues, not duplicate draft cards. Search by repository and issue title before adding; one tracked issue should have one project item.

## Lightweight automation

Review existing built-in workflows first. If available under the account's plan, enable auto-add for `repo:MarioSaenz356/DASWCD-Tree-Steward-LMS is:issue is:open`. Existing issues may need to be added manually; verify rather than assuming a backfill.

Set newly added items to Backlog. Move issues to Ready, In Progress, and Review manually; a linked PR opening does not automatically move its issue unless a separate workflow is configured.

Review the default close/merge workflows. Auto-Done on issue closure can also affect duplicates and cancelled issues, so either manage Done manually or explicitly correct/exclude not-planned closures. A merged PR card becoming Done does not itself prove that the issue's criteria were met. Use `Closes #N` only when the PR fully resolves that issue.

Do not add another GitHub Actions workflow or broad-scope token solely to synchronize this starter board. Built-in project workflows and manual updates are sufficient for now.

## Verify with a real issue

Choose one relevant issue from [initial-issues.md](initial-issues.md), first checking for duplicates. Confirm its assignee, labels, priority, and criteria. Add it to the project and verify the field/view behavior. Move it only as actual work progresses; verify that the eventual PR/issue closure is reflected correctly.

This board tracks work; it does not enforce branch protection. Follow [github-setup.md](github-setup.md) for repository rules and [github-issues-workflow.md](github-issues-workflow.md) for the sprint process.

References: [Projects quickstart](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/quickstart-for-projects), [built-in automations](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations).
