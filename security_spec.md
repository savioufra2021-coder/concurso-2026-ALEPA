# Security Specification — Meu Campus ALEPA 2026

## 1. Data Invariants & Role Separation
1. **Separated Roles (`student | teacher | editor | admin | dev`)**:
   - `student`: full access strictly inside `/users/{uid}` and own subcollections (`topicProgress`, `studySessions`, `simuladoAttempts`, `errorNotebook`, `disciplineGoals`, `readingProgress`, `mediaProgress`, `notifications`), read published catalog items (`exams`, `managedDisciplines`, `managedTopics`, `simuladoLists`, `platformNotices`, `classes` where active, `lessons` published, `activities` published, `materials` `isShared == true && status == 'published'`, `sharedQuestions` `isPublished == true && status == 'published'`), create/update own `submissions` and `enrollments`, and open/reply in own `academicRequests`.
   - `teacher`: strictly distinct from `editor` and `admin`. May manage `lessons`, `activities`, `enrollments`, and grade `submissions` ONLY within classes where `request.auth.uid in class.teacherIds` (stored on the document without unbounded arrays). May author `draft` or `in_review` `materials` (including structured chapters, study recommendations, `epub`/`html` metadata, `pendingDefinition`, `indexingStatus`) and `sharedQuestions` (including source page anchors and mandatory editorial review flags), without privilege to publish institutional catalog items directly (`status == 'published' && isShared == true`), manage user roles, change storage configuration, or inspect `auditLogs`. May respond to assigned or discipline-scoped `academicRequests` without `senderRole` spoofing.
   - `editor` (Administrador de Conteúdo): may review, approve, and publish `materials`, `sharedQuestions`, `managedDisciplines`, `managedTopics`, `simuladoLists`, `platformNotices`, and `lessons`, without privilege to manage user roles/activation, storage provider policies, or delete audit logs.
   - `admin` / `dev` (Administrador Principal): full governance over users (`role`, `active`, `assignedClassIds`, `assignedDisciplineIds`), `exams`, `classes`, `storageMetadata`, `familyMembers`, `academicRequests` routing/reassignment, and `auditLogs` read access.
2. **Storage Rules Hardening**:
   - `/campus-materials/{uploaderUid}/**` rejects verified students via cross-service `firestore.get(/databases/ai-studio-remixsavioalepa1-e4693aba-b1f3-4621-bddd-0813ec8e3b3f/documents/users/...)` role check (`admin | dev | editor | teacher` with `active != false`) plus `isPrimaryAdminEmail()`, enforces verified reads, 100 MB cap, and strict MIME allowlist (`application/pdf`, `application/epub+zip`, `video/*`, `audio/*`, `image/*`, PPTX/XLSX).
   - `/user-uploads/{userId}/**` restricts access strictly to owner or primary admin within 50 MB and safe MIME types (including `application/epub+zip`).
3. **Backend SSRF, Proxy Rate Limit, Security Headers & AI Quota Controls**:
   - `/api/materials/pdf-proxy`, `/api/materials/reader-proxy`, and `/api/gemini/summarize-pdf` enforce DNS/IPv4/IPv6 private-range checks, manual redirect validation (up to 5 hops), streaming byte caps, magic-byte validation (`%PDF`, ZIP for EPUB), and host allowlisting for HTML portal extraction.
   - `/api/materials/pdf-proxy`, `/api/materials/reader-proxy`, and `/api/spotify/resolve` enforce sliding-window per-visitor rate limiting (`ProxyRateLimiter`), timeouts, and bounded HTML reads.
   - Express configures `trust proxy` via validated `TRUST_PROXY_HOPS` (rejecting spoofable `X-Forwarded-For` hops), normalizes client IPs (`::ffff:` -> IPv4), isolates guest AI quotas per visitor IP, and sets `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`, and `Cross-Origin-Opener-Policy`.
   - `/api/gemini/*` and `/api/ai/*` enforce per-tier (`guest`, `student`, `staff`) rate limits, daily quotas, Firebase ID token verification for staff endpoints (`/api/ai/extract-questions`, `/api/ai/admin-assistant`, `/api/ai/teacher-assistant`), and SHA-256 response caching while keeping `GEMINI_API_KEY` exclusively server-side.
4. **Owner & Master Gate Discipline**:
   - Every `/users/{userId}` subcollection validates parent existence (`exists(/databases/$(database)/documents/users/$(userId))`), strict ownership (`isOwner(userId)`), bounded fields/arrays, and `updatedAt == request.time`.
   - User profile `preferences` (`theme`, `accentColor`, `fontScale`, `density`, `hiddenDashboardCards`, `dashboardCardOrder`, favorites, shortcuts, `preferredCampus`, `preferredMedioCargo`, `mediaPlaybackPreference`) are owner-editable via `affectedKeys().hasOnly(...)` without ever allowing edits to `role`, `active`, `assignedClassIds`, or `assignedDisciplineIds`.
5. **List, Field & Publication Hardening**:
   - Every `allow list` rule evaluates `resource.data` directly with zero cross-doc `get()`/`exists()` lookups on queried resources.
   - `isValidId(docId)` is enforced on `get`, `create`, `update`, and `delete` operations (never inside `allow list`).
   - All privileged/shared writes require `request.auth.token.email_verified == true`.
   - Shared/published `materials` forbid `local://` URLs and `storageProvider == 'local'`; published/shared `materials`, `sharedQuestions`, and `lessons` forbid internal `reviewNotes`.
   - `familyDocId()` mirrors client `toFamilyMemberDocId()` normalization (`.trim().lower().replace(...)` capped at 128 chars).
   - `auditLogs` and `/academicRequests/{requestId}/messages/{messageId}` are strictly append-only (`allow update, delete: if false`) and never store passwords, OAuth tokens, or API secrets.

## 2. Adversarial Test Matrix (Dirty Dozen + Multi-Role RBAC)
1. Unauthenticated read/write on `/users/u1` -> PERMISSION_DENIED.
2. Unverified email (`email_verified: false`) writing `/users/u1` or `/auditLogs` -> PERMISSION_DENIED.
3. Student spoofing `role: 'teacher'` or `role: 'editor'` on `/users/u1` create/update -> PERMISSION_DENIED.
4. Student injecting shadow field `isVerified: true` or modifying `active`/`assignedClassIds` -> PERMISSION_DENIED.
5. Student uploading into `/campus-materials/{studentUid}/...` in Cloud Storage -> PERMISSION_DENIED.
6. Teacher attempting to publish institutional `isShared: true, status: 'published'` on `/materials/m1` -> PERMISSION_DENIED.
7. Content Editor attempting to read `/auditLogs` or delete `/storageMetadata/f1` -> PERMISSION_DENIED.
8. User A reading/listing User B's `/users/u2/errorNotebook` or `/academicRequests` belonging to Student B -> PERMISSION_DENIED.
9. Student updating `manualScore`, `finalScore`, or `gradedBy` on own `/submissions/s1` or spoofing `senderRole: 'teacher'` in `/academicRequests/{id}/messages` -> PERMISSION_DENIED.
10. Client-forged `createdAt` or `updatedAt != request.time` on `/users/u1/studySessions/s1` or `/auditLogs/l1` -> PERMISSION_DENIED.
11. Mutating or deleting `/auditLogs/{logId}` or `/academicRequests/{id}/messages/{msgId}` -> PERMISSION_DENIED.
12. Blanket `list` query on `/materials`, `/submissions`, or `/academicRequests` without authorized filter -> PERMISSION_DENIED.
