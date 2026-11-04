# Course navigation, retakes, and learning materials

This change extends the existing frontend. It does not implement backend routes,
database migrations, production authentication, or S3/MinIO provisioning.

## Implemented frontend behavior

- Query-string routes identify module, page, quiz builder, student quiz, and preview.
  Browser Back/Forward and refresh restore course locations without Netlify rewrites.
- Quiz cards and instructor previews open in the same tab. The old popup launch
  token and `window.open` handoff are removed.
- Quiz answers are saved in sessionStorage per account, quiz, and preview mode.
  Drafts are restored only when the question definition still matches. A successful
  submission or explicit sign-out clears drafts. Preview never submits a grade.
- The shared API client handles errors and emits `session-expired` on HTTP 401.
  HTTP 403 remains a permission error and does not sign out the user.
- Demo role selection survives refresh for two hours. Real prototype identities
  are deliberately not restored as authenticated sessions from browser storage:
  refreshing a real-account page requires sign-in again, keeping the destination.
- Teacher retake settings support 1–10 total attempts. Demo attempts are retained
  and limits enforced locally. Live controls are disabled unless the quiz response
  explicitly advertises `capabilities.retakePolicy: true`.
- Demo PDF/MP4/WebM files and metadata use IndexedDB. They survive refresh and
  sign-out on the same browser and are not shared or official course records.
  Demo quizzes also persist across sign-out so teacher/student flows can be tested.
- Material forms validate type, nonzero size and the 100 MB limit. Video transcripts
  are required. Live uploads include progress, errors, and retry without reselecting
  the file. Existing materials can be edited or have their file replaced.

## Backend handoff: authentication

The current backend uses `X-User-Id`, which is a prototype identifier, not a secure
session. Replace the shared request-header function and login flow when the team's
authentication implementation is integrated. Add a session endpoint (or the chosen
provider's supported session check), loading state, and automatic restoration from
that validated response. Return 401 for expired sessions and 403 for denied access.
Never put authentication tokens in page URLs. The current frontend does not implement
token refresh or claim that its demo-role expiry validates real sessions.

## Backend handoff: quiz policy

- Add `maxAttempts` (integer 1–10, total including initial attempt) to quiz detail
  and list responses. Include `capabilities: { retakePolicy: true }` only once
  enforcement is implemented. Missing policy is displayed as unknown, not enforced.
- Extend existing `PATCH /api/quizzes/:id` to accept `{ title, maxAttempts }`.
  Check instructor/module assignment or admin access server-side.
- Existing `GET /api/quizzes/:id/attempts/me` supplies attempt history.
- Enforce the limit transactionally on submission, including simultaneous requests,
  and prevent retries from creating duplicate attempts (idempotency).
- Preserve previous attempts and keep questions locked after submission.
- Agree with the sponsor whether the highest or latest score counts toward grades,
  and when correct answers are revealed. The frontend displays attempt history and
  the latest score; it does not choose an official grade aggregation policy.
- Consider existing quizzes/attempts when migrating to a default attempt limit.

## Backend handoff: shared files

The frontend adapter is disabled by default. Do not enable
`VITE_MATERIALS_API_ENABLED=true` until these proposed endpoints exist and are tested:

| Method | URL | Response |
| --- | --- | --- |
| GET | `/api/modules/:moduleId/materials` | `{ materials: Material[] }` |
| POST | `/api/modules/:moduleId/materials` | `{ material: Material }` |
| PATCH | `/api/materials/:id` | `{ material: Material }` |

POST/PATCH accept multipart form data: `metadata` is JSON containing `title`,
`description`, `transcript`, and `published`; `file` contains the binary upload.
PATCH may omit `file` to retain it. Save file and metadata together; return success
only once durable storage is confirmed. Consider an idempotency key before enabling
automatic retries: a timeout can occur after a successful server save.

`Material` uses the existing card model:

```json
{
  "id": "stable-id",
  "moduleId": 2,
  "type": "Learning material",
  "title": "Tree identification guide",
  "description": "Read before the field walk.",
  "published": true,
  "transcript": "",
  "resource": { "name": "guide.pdf", "kind": "pdf", "url": "/api/files/stable-id" }
}
```

The server must validate file content/type/size, authorize uploads and edits,
filter unpublished files from student lists, and protect downloads. Native links
and video elements cannot send the prototype `X-User-Id` header: use an authenticated
cookie-based download route or short-lived signed URLs. For signed URLs, define
renewal when an open video/link expires. Never expose storage credentials in Vite.
This adapter uses multipart-to-backend uploads; change only this adapter if the team
chooses presigned direct-to-storage uploads instead.

## Verification

Run `npm test`, `npm run lint`, and `npm run build` in `frontend`.

Manual browser checks performed: instructor attempt settings, student same-tab
quiz, answer restoration on refresh, Back/Forward, keyboard submission, two-attempt
limit after refresh, and PDF demo save/open after refresh.

Still requires backend integration testing: secure session restore/expiry, actual
shared uploads and interrupted network retries, access to protected files, server
retake enforcement under concurrency, and production deployment configuration.
Video transcript validation and file constraints have frontend checks; test real
video playback, captions, mobile devices, and storage-quota failures before release.
