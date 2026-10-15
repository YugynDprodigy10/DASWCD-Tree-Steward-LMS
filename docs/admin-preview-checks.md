# Administrator preview checks

Run `npm run dev` from `frontend`, then choose **Administrator demo**. Use sample addresses and made-up passwords only. No email or account changes leave the browser.

## Functional checks

1. Invite a student. Verify that the invitation appears as Pending. Try `JORDAN@example.com` and confirm that the existing account is detected.
2. Preview acceptance. Mismatching passwords must show a validation error. Matching passwords of at least 12 characters add one sample person and mark the invitation Accepted.
3. Revoke a pending invitation. Acceptance should be unavailable until it is renewed. Renew an expired invitation as well.
4. Change Jordan's email. Confirm that the 3/12 sample completion count remains and no duplicate person is created.
5. Filter People by role and search by name/email. Clear filters from an empty result.
6. Assign Morgan to Week 1 using Role & modules. Confirm the name appears on the Modules page; remove the assignment there and verify the unassigned state.
7. Deactivate Morgan. Confirm reset is disabled and Morgan no longer counts as an active assigned instructor. Reactivate to restore saved assignments.
8. Preview an admin password-reset request. Confirm the result explicitly says no email was sent.
9. Sign out, open Forgot password, and complete the request/reset preview. Confirm no real password change is claimed.
10. Sign out and re-enter the admin demo. Sample changes must reset. Verify student and instructor demos still open normally.

## Responsive and keyboard checks

- Check desktop and phone widths (including 320px). Confirm no horizontal overflow, usable bottom navigation, and a scrollable invite/module dialog.
- Open a dialog by keyboard; Escape should close it and return focus to its trigger.
- Verify form labels, required fields, and password confirmation errors.

## Scope

The sample directory and module assignments do not change authentication or the separate instructor demo's permissions. Real integration needs backend authorization and a shared account/course data source. Progress is explicitly illustrative. The 12-character password minimum is a preview choice, not a finalized backend policy.

## Module and people management checks

- Add a module and verify both audience switches start off. Enable instructors only: it must appear in Instructor preview and be absent in Student preview. Edit its details and reject duplicate titles.
- Add a sample administrator. Saving requires explicit administrator confirmation. Verify the role filter finds them.
- Remove a person, find them with Show removed, then restore them as inactive without replacing their ID or progress.
- Open Send invite link. Copy the sample `.invalid` URL and preview delivery; the result must explicitly say no email was sent.
- Module switches affect only the admin catalog preview until shared course data and backend permissions are connected. They do not currently control the separate student/instructor demo pages.

## Course content and keyboard checks

- In Instructor demo, Create offers Announcement, Learning material, Quiz, and Final exam. Assignment submissions have been removed.
- Learning materials accept a nonempty PDF, MP4, or WebM up to 100 MB. Videos require a text transcript. Publish a file and verify student preview offers opening/downloading it; video files also use native playback controls.
- Files are browser-session attachments, not shared server uploads. Refresh/sign-out clears them. Accessible PDFs and captioned videos must be supplied by instructors.
- Quizzes use HTTPS Google Forms responder links and multiple-choice questions. Final exams declare 1–3 written-response questions alongside multiple choice. The LMS cannot inspect question types or sync grades; verify the form and its access permissions separately.
- Navigate with Tab/Shift+Tab, activate buttons with Enter/Space, use arrow keys in selects, and close dialogs with Escape. Verify focus remains in dialogs and returns to their trigger. Check visible focus and mobile layouts.
