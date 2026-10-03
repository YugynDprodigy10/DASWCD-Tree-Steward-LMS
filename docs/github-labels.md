# Labels for Tree Steward LMS

No remote labels were inspected or created: GitHub CLI is unavailable in this environment. Before creating labels, open the repository's Issues > Labels and compare existing names, including case variants. Reuse matches (especially GitHub's default bug/documentation labels); create only missing names. Avoid renaming or replacing existing labels without team agreement.

| Label | Description |
| --- | --- |
| frontend | React UI behavior and frontend integration |
| backend | Server logic and API implementation |
| database | PostgreSQL schemas, migrations, queries, and persistence |
| auth | Login, account security, and authorization |
| quiz | Quiz authoring, attempts, grading, and assessment results |
| modules | Weekly course modules, learning content, and ownership |
| communication | Class messaging and communication features |
| testing | Automated tests, manual verification, and quality assurance |
| documentation | Setup instructions, guides, and technical documentation |
| devops | CI, builds, deployment, and repository configuration |
| ui-ux | Interface design, usability, and interaction improvements |
| accessibility | Keyboard access, semantics, contrast, and assistive technology |
| feature | New user-facing capability |
| bug | Existing behavior that does not match expectations |
| blocked | Work cannot proceed until a documented dependency is resolved |
| high-priority | Core capability, critical defect, or work blocking other tasks |
| medium-priority | Important planned work that does not currently block delivery |
| low-priority | Useful improvement that can wait behind core work |

Suggested colors: area labels blue/green, feature purple, bug red, blocked orange, high-priority red, medium-priority yellow, low-priority gray. Names and descriptions matter more than colors.

Each issue needs appropriate area labels and exactly one priority label. Add feature or bug where applicable; technical tasks do not need an invented type label. Add blocked only while the dependency is active. Do not use labels as a second status board.

Form defaults reference feature, bug, and ui-ux; create any missing labels before using the forms because form files do not create labels. Area/priority dropdown answers do not dynamically apply labels; the triager does this. Keep the Project Priority field synchronized manually with the priority label.
