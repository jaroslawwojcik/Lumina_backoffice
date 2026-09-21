# Session video upload MVP

Implemented from the product decisions supplied after the original media upload
specification. Those decisions supersede the earlier durable upload/draft-intent
proposal. This iteration covers a single primary video in a new or existing
session; audio, Storage/CDN, images, documents, webhook processing and cleanup
are subsequent work.

## Behavior

1. Select or drop a supported video in the session form and confirm its required
   editorial name. The server validates MIME, non-empty size, name and configured
   limit. Preparing creates a Bunny video and returns TUS credentials plus an
   encrypted, expiring, actor-bound ticket. It writes nothing to PostgreSQL.
2. Browser uploads directly using tus-js-client. Pause/resume works on the same
   page. Credentials and tickets are kept in memory; no persistent upload queue
   or recovery after reload is implemented. Preparing is never automatically
   retried after an ambiguous remote response.
3. After byte transfer, the UI polls the API. The backend reads Bunny video
   status and metadata. Only status 3 with positive duration/width/height is
   accepted. Failed encoding creates no local records. Polling stops at terminal
   state or a request error; errors offer an explicit retry.
4. The editor confirms the ready film. The backend checks Bunny again and saves
   it. An existing session receives a new asset, current assignment and new
   immutable revision in one serializable transaction. A new form receives the
   ready asset ID; saving that form creates the session, assignment and first
   revision atomically using the provider duration.
5. Repeated completion of the same ticket returns the existing asset/revision.
   A unique successful-operation ID and provider library/video index prevent
   duplicates. Serialization conflicts return 409; retry the same completion.
6. If the session revision changed during upload, completion does not overwrite
   it. The editor can save the ready video only to the library, then explicitly
   assign it against the current revision. Every assignment change creates a
   revision; replacement requires the expected current revision ID.

A completed ready file saved to the library may remain unassigned if the new
session form is abandoned. A transfer that is cancelled or abandoned before
completion creates no local asset, revision or assignment. Remote Bunny files
may remain orphaned: cleanup was explicitly excluded from this MVP.

A locally pending replacement does not modify the persisted draft. Publishing
an already complete older revision still publishes its older ready media; the
uncommitted browser selection cannot enter a release.

## Immutable publishing

`content.revisions.media_snapshot` stores a server-authored JSON snapshot of
asset identity, role/locale/position, provider/library/locator, duration and
verified readiness. This field is separate from editable content JSON. Raw JSON
cannot manufacture a trusted media snapshot. Ready primary metadata overrides
editable duration/media-kind values when a session revision is saved.

Build and activation reject session revisions without a ready primary and any
revision containing unverified media. Catalog thumbnails and published session
or curriculum durations come from the selected revision. Playback obtains the
same release context used for access evaluation, and selects its revision's
media snapshot. It does not follow mutable `resource_assets`. A configured
playback library must match the library stored in the snapshot.

Historical revisions receive an empty media snapshot and existing manually
registered assets remain unverified. There is deliberately no attempt to infer
historical bindings or trust old client-entered metadata. **Before applying this
change to a populated environment, plan verification and republishing of existing
content. Old releases without snapshots will no longer return playback URLs.**
This is a controlled rollout requirement, not an automatic historical backfill.

## API surface

All endpoints below require the existing admin authentication policy. That policy
requires a verified Firebase token with admin=true; /admin/me currently exposes
all bootstrap permissions. Granular staff-role authorization is outside this MVP.

| Endpoint | Behavior |
| --- | --- |
| GET /api/v1/admin/media/video-uploads/configuration | Enabled state, MIME allowlist and size limit; no secrets |
| POST /api/v1/admin/media/video-uploads | Prepare remote video and stateless signed ticket |
| POST /api/v1/admin/media/video-uploads/status | Read status using the ticket in the request body |
| POST /api/v1/admin/media/video-uploads/complete | Verify readiness and persist once; optional saveToLibrary |
| POST /api/v1/admin/sessions | Optional primaryAssetId binds an already verified video |
| POST/PUT /api/v1/admin/resources/{id}/assets | Creates an immutable revision; PUT requires expectedRevisionId |

Existing response IDs are preserved. Asset responses additionally expose
`displayName`, `originalFileName` and `providerStatus`. Source byte count is a
browser declaration kept separately from Bunny's transcoded storage byte count.
The configured size limit is checked at prepare; TUS does not cryptographically
bind that declared size. Definitive source-byte inspection/quota reconciliation
is future provider work. No placeholder duration is stored for processing video.

## Server configuration

Set these using .NET user secrets locally, or backend environment/secret-manager
configuration. Never put them in VITE_*.

| .NET key | Environment key | Purpose |
| --- | --- | --- |
| BunnyUpload:LibraryId | BunnyUpload__LibraryId | Numeric Stream library ID |
| BunnyUpload:ApiKey | BunnyUpload__ApiKey | Stream management API key |
| BunnyUpload:MaximumBytes | BunnyUpload__MaximumBytes | Positive source upload limit; default 5 GiB |
| BunnyUpload:AuthorizationHours | BunnyUpload__AuthorizationHours | TUS validity, 1–48 hours; default 24 |
| Bunny:LibraryId | Bunny__LibraryId | Same library for protected playback |
| Bunny:TokenAuthenticationKey | Bunny__TokenAuthenticationKey | Playback token key, separate from upload API key |
| Bunny:EmbedBaseUrl | Bunny__EmbedBaseUrl | Existing playback base URL |
| DataProtection:KeysPath | DataProtection__KeysPath | Protected persistent key-ring directory shared by API replicas |
| DataProtection:ApplicationName | DataProtection__ApplicationName | Stable environment-specific application discriminator |

Missing upload keys leave the API running and the upload UI disabled with an
explanation. Official Bunny management/TUS endpoints are fixed provider endpoints.
Deployments must preserve/share Data Protection keys for the ticket lifetime;
otherwise a restart or another replica can invalidate in-flight confirmations.
The default discriminator includes ASP.NET environment name. Keep TEST/UAT/PROD
key rings, Bunny libraries and credentials separate.

Tickets expire after 48 hours. TUS transfer expiry is separate and may be earlier;
this MVP does not renew transfer credentials. Request bodies containing tickets,
TUS authorization headers or provider access keys must not be logged by hosting
middleware. No Bunny credentials were added to local frontend configuration.

## Migrations and local run

EF migrations are supplied but were not applied to the running application DB:

- AddExistingBackofficeFoundation: separate prerequisite for pre-existing
  backoffice entities already present in the workspace model but missing from
  its previous migration snapshot. It does not introduce an upload queue.
- AddVerifiedRevisionMedia: verified asset metadata, successful-operation IDs,
  and per-revision media snapshots.
- EnforceRevisionMediaSlots: unique (resource, role, locale, position), including
  NULL locale. Existing duplicates must be resolved deliberately before rollout;
  the migration does not delete or arbitrarily choose records.

Run the migration step against the intended TEST database before starting the
new API build. From Lumina_api:

```powershell
dotnet tool restore
dotnet ef database update --project src/Lumina.Persistence --startup-project src/Lumina.Api --configuration Release
```

Restart the API after migration/configuration. The running Visual Studio debug
process was not terminated during implementation; builds/tests used Release.
Restart Vite when changing its environment; its existing API/Firebase settings
remain in Lumina_backoffice/.env.local.

## Validation and limits

Automated coverage includes required name, pause/resume without a second prepare,
processing versus ready, cancellation without finalization, authenticated API
access, signed-ticket tampering, provider preparation validation, finalization
idempotency, stale-revision conflict, new-session provider duration, immutable
snapshot playback, publication readiness and PostgreSQL migrations. Existing
publishing fixtures were adapted to include verified media; unrelated fixture
collisions and an expired fixed-date access grant were made isolated/time-stable.

Real transfer, encoding and playback against Bunny remain to be validated with
TEST infrastructure once supplied. No production deployment, provider provisioning,
webhook endpoint, database upload queue or orphan-cleanup worker was added.

Final automated run: 159 backend tests passed (including PostgreSQL migration,
constraint and transaction tests), 52 frontend tests passed; Release backend
build, frontend production build and ESLint passed. Provider transfers were not
executed without the pending Bunny configuration.
