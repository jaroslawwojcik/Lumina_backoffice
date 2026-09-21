This is the pre-implementation review. Later MVP decisions and implemented scope are documented in [session-video-upload-mvp.md](session-video-upload-mvp.md).

# Media upload specification: implementation gap review

Reviewed against `lumina-backoffice-media-upload-spec.md` and the active
.NET source. This is a local code review, not confirmation of a configured
Bunny account or Storage zone capabilities.

## Existing foundation

- `ContentAsset` stores kind, provider locator, MIME, bytes, dimensions and
  duration. It requires a provider locator when created.
- Admin API supports asset registration, library listing, and assigning or
  replacing a resource asset.
- `ResourceAssetRole` uses `Subtitle`; retain `subtitle` in HTTP contracts
  instead of introducing the specification's alternate `caption` name.
- Frontend already recognizes `media.upload` and `media.assign` permissions.
- Bunny integration currently provides playback authorization, not upload.

## Required additions

| Area | Missing work |
| --- | --- |
| Asset model | Editorial/original names, status, checksum, provider metadata, readiness/failure timestamps and actor |
| Upload lifecycle | Persistent upload entity, ownership, idempotency, expiry, cancellation and credential renewal |
| New content | Draft context ownership and durable attachment intent, transactionally linked at creation |
| Stream | Video creation, TUS signatures, provider state reads, verified events and polling |
| Storage | Verified S3 configuration, object-scoped signing, multipart state and final object verification |
| Worker | Lease/retry/dead-letter lifecycle, readiness-driven attachment and provider cleanup |
| Release | Enforce readiness for required media and snapshot resolved asset references |
| Frontend | Drop zones, required name dialog, persistent transfer queue, progress and resume, filtered library picker |
| Operations | Usage queries, detach, explicit replacement conflict handling and audited deletion |

The specification's example create-session payload omits slug and duration,
which the current command requires. Extend the command deliberately for
pending uploads rather than copying the example as a replacement contract.
The existing integer duration contract also needs an explicit rounding rule
for fractional browser/provider duration metadata.

## Smallest complete first implementation

A video upload into one session form: required library name, durable draft
context, prepare/TUS/complete/status, save while processing, worker attachment
after verified readiness, and release rejection until ready. This requires
an EF migration and backend changes before the frontend can offer real upload.
Then reuse the lifecycle for Storage and all other content forms.

Before implementing provider signing, recheck the current official Bunny
TUS, webhook and S3 documentation and the configured TEST Storage zone.
No Bunny secrets belong in frontend environment variables. This review does
not provision providers, modify credentials, migrate the database or execute
the embedded Copilot prompt.

## Detailed findings and implementation order

### P0: Published playback currently follows mutable draft assignments

Evidence: `Lumina_api/src/Lumina.QueryServices/Media/GetMyPlaybackAuthorizationHandler.cs`
joins an active release to current `ResourceAssets` and `ContentAssets`, then
selects a `bunny_stream` primary external ID. It does not resolve an immutable
asset mapping stored with that release. Thus changing a draft assignment can
change the media resolved for a published resource. Multiple primary slots
can also conflict with its `SingleOrDefaultAsync` lookup.

Before enabling automatic replacement, add a release-scoped asset snapshot
(asset identity, provider locator, role, locale, position and required delivery
metadata) and resolve playback/download from that snapshot. Update publishing
and protected-media queries together. Existing active releases need an explicit
migration/backfill strategy; never infer historical asset identity from a draft
that has already changed. Regression test: publish A, replace draft with B,
verify live playback remains A until a new release is activated.

The existing query only supports Bunny Stream. Storage-backed audio and
protected downloads require a separate delivery strategy with server-side
access checks. Upload success alone will not make Storage audio playable.

### P0: Assignment conflicts are silently replaced

Evidence: `Lumina.CommandServices/Content/AssignResourceAssetHandler.cs` removes
existing rows for the slot or the same asset/role. Both POST and PUT in
`Lumina.Api/Controllers/AdminResourcesController.cs` use this command.
There is no explicit replace flag or expected assignment version.

`ResourceAssetConfiguration.cs` has a non-unique lookup index for
(resource, role, locale, position). The primary key is (resource, asset, role).
The specification's assertion that slot uniqueness already exists is incorrect.
The current key also prevents the same asset/role from occupying multiple
language positions even where that might be desired.

Use an assignment identity or revised key, plus a unique slot constraint with
explicit NULL-locale semantics (for example NULLS NOT DISTINCT where supported,
or separate partial indexes). Audit existing duplicates before migration.
Creation should conflict on occupancy; replacement should require the expected
assignment/version and return 409 when stale. A pending upload must capture the
expected slot state so a worker cannot overwrite a newer editor assignment.
Test concurrent replacement against PostgreSQL, not an in-memory provider.

### P1: Role rules differ from the proposed UX

Evidence: `ResourceAsset.EnsureRoleCompatibility` and
`AssignResourceAssetHandler.ValidateResourceCompatibilityAsync`.

| Requirement | Existing behavior | Proposed resolution |
| --- | --- | --- |
| Program forbids primary | Already enforced | Reuse server rule |
| Images in thumbnail/hero/artwork | Already enforced | Reuse server rule |
| Audio download | Download accepts Document only | Extend allowlist with explicit download policy |
| Main PDF/image file | Primary accepts Audio/Video only | Use Download for downloadable documents; deliberately define display-only image/document role semantics |
| Language-specific captions | Subtitle kind exists; locale optional | Require normalized locale for language-dependent attachments |
| Caption role name | Existing contract is subtitle | Keep subtitle; change the proposed UI type alias |
| Alt text | No field on asset or assignment | Prefer localized assignment text; define release validation policy |

Do not infer routing solely from MIME. A video for downloading and a video for
watching require different routing; the prepare contract must include a
validated use/purpose or derive it from resource type and downloadable policy.
For unsaved content the request must carry enough intended content metadata to
validate audio/video compatibility again at commit.

### P1: Draft and upload ownership need explicit contracts

The proposed draft UUID is a correlation key, not authorization. Bind it to the
verified actor and environment, check ownership on prepare/status/renew/commit,
and prevent a second resource from claiming it. Use a stable draft identity
across route navigation and retries, with an expiry policy. Commit ready and
pending attachments in the same transaction as content creation.

Add additive optional `draftContextId` fields to create-session/material/program
commands; return attached/pending state without removing existing response IDs.
The example in the specification is incomplete for the current session command:
slug and integer duration are required. Define how to save a video draft before
authoritative duration exists. A nullable draft duration is a model change;
using zero or invented duration would be incorrect. Preserve current clients
and block publication until authoritative metadata is complete.

### P1: Asset registration does not verify a provider object

`ContentAsset` requires a locator at creation and stores basic metadata supplied
to registration. It has no editorial name, original filename, readiness,
checksum or processing history. Introduce an explicit pending asset factory or
create the upload first, without fabricating a provider locator. Keep operation
state in `media.uploads` and long-lived provider readiness on the asset.
The earlier `backoffice-contracts-and-data-model.md` describes `media.uploads`
as planned work; there is no implemented upload table to merely extend.

For existing assets add a deliberate `unknown`/verification migration path.
Do not mark every historical asset ready without provider verification. Store
technical metadata separately from browser estimates and redact provider errors.
Original source byte size and transcoded Stream storage size need separate
semantics; neither should silently overwrite the other.

### P1: Worker and authorization foundations are partial

`InboxEventDispatcher` already provides PostgreSQL claiming, five-minute leases,
retry scheduling and dead-letter handling. Reuse this integration pattern and
add Bunny processors plus reconciliation jobs. The current worker runs inbox
dispatch; adding an outbox entity alone does not schedule media cleanup.

Add polling for missed webhooks, crash recovery after provider creation,
non-regressing state transitions, attachment finalization and bounded cleanup.
Persist operation intents before remote side effects. A local idempotency key
does not by itself guarantee exactly one provider object after a timeout;
define reconciliation for an unknown Create Video outcome before retrying.

Current Admin authorization checks `admin=true`; `/admin/me` returns all
bootstrap permissions. Separate media.upload/media.assign enforcement is not
yet a granular server authorization system. Add policies/resolution appropriate
to the chosen staff model, and actor audit mapping via Firebase UID, not email.

### P1: Frontend additions

Existing `MediaLibraryPage` registers provider identifiers and shows a paged
library. It lacks uploads, editorial-name/status filters and lifecycle actions.
CreateResourcePage, ResourceDetailPage and ProgramAuthoringPages need a shared
media section. Keep an upload queue above route-level components and use the
existing React Query/Context baseline. Add tus-js-client and a separate direct
provider transport: never reuse the API transport that attaches Firebase tokens.

The browser may need the file selected again after reload; do not promise
unattended recovery of an unavailable File object. Persist upload identity and
safe fingerprints, not signed credentials. Pause keeps the operation; cancel
records durable intent and schedules provider cleanup. Stop polling on terminal
states (the embedded prompt's 'polling only terminal states' wording is inverted).

## Official provider documentation checked on 2026-09-15

- TUS: server-created video plus SHA256 credentials are supported. Renewing
  credentials for the same video does not extend the original TUS resource
  expiry; expired uploads can return 404. Distinguish credential renewal from
  creation of a replacement transfer. [Bunny TUS](https://bunny.net/docs/stream/tus-resumable-uploads)
- Webhooks: v1 uses HMAC-SHA256 over raw bytes with the library Read-Only API
  key. The signature includes no timestamp; deduplication and authoritative
  status reconciliation remain necessary. [Bunny webhooks](https://bunny.net/docs/stream/webhooks)
- Storage: S3 is in public preview and must be enabled at zone creation.
  Presigned and multipart uploads exist; multipart is recommended above 100 MB,
  limited to 10,000 parts and expires after ten days. S3 lacks object versioning
  and custom metadata. HEAD exposes ordinary object metadata, not authoritative
  audio duration or image dimensions; add file inspection for those. Multipart
  ETag is not whole-file SHA256. [Bunny S3](https://bunny.net/docs/storage/s3)

These checks confirm the documentation, not the capabilities of the user's
actual Storage zone. No provider credentials or account settings were inspected.

## Infrastructure inputs needed before end-to-end validation

- TEST Stream library ID and server-side management key; separate Read-Only
  key for webhook verification. Current `Bunny:TokenAuthenticationKey` is for
  playback and is not an upload API key.
- TEST Storage zone's S3-enabled flag, EU endpoint/region and zone name; secret
  stored in backend configuration only. Create a separate zone if incompatible,
  after an infrastructure decision rather than silently migrating existing data.
- Pull Zone/domain, protected-delivery signing configuration, preview policy,
  file-size/type limits and public HTTPS webhook destination.
- Retention/cancellation rules, administrative quotas and acceptable draft
  duration/metadata behavior before encoding completes.

Proposed configuration sections should be separate for Stream upload, Storage
upload and CDN delivery. These settings do not exist yet; do not add guessed
names to .env.local and expect upload to work.

## Delivery sequence and acceptance checks

1. Model/contract decisions: roles, slot identity, ownership, nullable draft
   metadata, readiness and release-scoped media. Add reviewed EF migrations;
   inspect existing data before enforcing constraints.
2. Complete Stream slice: one session form with name dialog, TUS prepare/resume,
   status/complete, draft commit, verified ready attachment, release gate and
   immutable playback. Use fake gateways in focused tests and a TEST library
   for actual transfers.
3. Storage slice: presigned PUT/multipart, authoritative completion and metadata
   inspection, protected audio/download delivery, interrupted-part recovery.
4. Reuse across all forms and library flows; add safe replace/detach/usages and
   background cleanup, with permission and audit coverage.

Focused integration cases: duplicate prepare/complete, crash after remote
creation, stale replacement, duplicate/out-of-order webhook, lost webhook,
foreign draft ID, concurrent slot assignment with NULL locale, processing
release rejection, unchanged published media after draft replacement, multipart
resume and missing part, source/type mismatch, expired authorization, and
absence of provider secrets in responses/logs/frontend artifacts.

No upload implementation, provider provisioning or database migration was
performed as part of this analysis.


