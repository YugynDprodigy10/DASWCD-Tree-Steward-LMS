# Administrator preview checks

Run `npm run dev` from `frontend` and enable the local test-login flags documented in README.md. Start the backend and database, then choose **Test administrator**. These checks cover an admin workspace backed by local sample UI data; admin account changes are not persisted to the LMS database or sent by email.

## Functional checks

1. Invite a student. Verify that the invitation appears as Pending. Try `JORDAN@example.com` and confirm that the existing account is detected.
2. Preview acceptance. Mismatching passwords must show a validation error. Matching passwords of at least 12 characters add one sample person and mark the invitation Accepted.
3. Revoke a pending invitation. Acceptance should be unavailable until it is renewed. Renew an expired invitation as well.
4. Change Jordan's email. Confirm that the 3/12 sample completion count remains and no duplicate person is created.
5. Filter People by role and search by name/email. Clear filters from an empty result.
6. Assign Morgan to Week 1 using Role & modules. Confirm the name appears on the Modules page; remove the assignment there and verify the unassigned state.
7. Deactivate Morgan. Confirm reset is disabled and Morgan no longer counts as an active assigned instructor. Reactivate to restore saved assignments.
8. Preview an admin password-reset request. Confirm the result explicitly says no email was sent.
9. Confirm Auth0 owns actual sign-in and password recovery. Do not represent the test administrator's sample reset as a real password change.
10. Sign out and re-enter the test administrator account. Sample changes must reset. Verify test student and instructor accounts still open normally.

## Responsive and keyboard checks

- Check desktop and phone widths (including 320px). Confirm no horizontal overflow, usable bottom navigation, and a scrollable invite/module dialog.
- Open a dialog by keyboard; Escape should close it and return focus to its trigger.
- Verify form labels, required fields, and password confirmation errors.

## Scope

The sample directory and module assignments do not change Auth0 authentication or the instructor's API permissions. Progress is explicitly illustrative. The 12-character password minimum applies only to the local invitation preview, not to Auth0 accounts.

## Module and people management checks

- Add a module and verify both audience switches start off. Enable instructors only: it must appear in Instructor preview and be absent in Student preview. Edit its details and reject duplicate titles.
- Add a sample administrator. Saving requires explicit administrator confirmation. Verify the role filter finds them.
- Remove a person, find them with Show removed, then restore them as inactive without replacing their ID or progress.
- Open Send invite link. Copy the sample `.invalid` URL and preview delivery; the result must explicitly say no email was sent.
- Module switches affect only the admin catalog preview until shared course data and backend permissions are connected. They do not currently control the separate student/instructor course pages.

## Course content and keyboard checks

- In the test instructor account, Create offers Announcement, Learning material, and built-in Quiz; Final exam is disabled pending written-response API support. Assignment submissions have been removed.
- Learning materials accept a nonempty PDF, MP4, or WebM up to 100 MB. Videos require a text transcript. Publish a file and verify student preview offers opening/downloading it; video files also use native playback controls.
- Files are browser-session attachments, not shared server uploads. Refresh/sign-out clears them. Accessible PDFs and captioned videos must be supplied by instructors.
- Built-in quiz checks and API limitations are documented in the README. Google Forms links have been replaced.
- Navigate with Tab/Shift+Tab, activate buttons with Enter/Space, use arrow keys in selects, and close dialogs with Escape. Verify focus remains in dialogs and returns to their trigger. Check visible focus and mobile layouts.
