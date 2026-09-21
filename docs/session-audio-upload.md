# Session audio upload

New and existing audio sessions have an independent **Główne nagranie audio**
drop area. The editor supplies a library name, uploads, then explicitly confirms.
The image drop area remains independent. Supported formats are MP3 and M4A with
AAC audio (one audio track, optional embedded cover artwork, no video).
The default and hard upload ceiling is 128 MiB; deployments can lower it.

## Bunny setup

Create a dedicated private Storage zone and connect a CDN Pull Zone to it.
Uploaded objects use `audio/<random-guid>.mp3` or `audio/<random-guid>.m4a`.
The folder is created by upload; no manual directory setup is needed.

The existing thumbnail Storage zone is public. Do not reuse it: a second protected
CDN host would not remove access through the existing public image CDN. This
implementation rejects the configured image zone and image CDN hostname for
audio. Keep all other Pull Zones connected to the audio zone protected as well.

In the audio Pull Zone's Security settings, enable **Token Authentication** and
copy the URL Token Authentication Key. Leave Token IP Validation disabled: this
implementation issues resource-scoped tokens without IP binding. Ensure there
are no alternate public hostnames, origins, or rules bypassing authentication.
Verify that an unsigned audio URL returns 403 before publishing paid content.

Add to existing **Lumina.Api** user secrets locally (placeholders only):

```json
"BunnyAudio:ZoneName": "YOUR_PRIVATE_AUDIO_STORAGE_ZONE",
"BunnyAudio:AccessKey": "YOUR_AUDIO_STORAGE_ZONE_PASSWORD",
"BunnyAudio:Endpoint": "https://storage.bunnycdn.com",
"BunnyAudio:CdnBaseUrl": "https://YOUR-PROTECTED-AUDIO-PULL-ZONE.b-cdn.net",
"BunnyAudio:TokenAuthenticationKey": "YOUR_AUDIO_CDN_TOKEN_KEY",
"BunnyAudio:MaximumBytes": 134217728,
"BunnyAudio:FfprobePath": "ffprobe"
```

Use the Storage HTTP endpoint for the selected region, not the S3 endpoint.
The supplied endpoint is Frankfurt. CDN base must be an HTTPS hostname without
a path. In deployed environments replace `:` with `__` and use the secret manager.
Never expose these settings through `VITE_*`. Use separate TEST/UAT/PROD zones.
Restart the API after configuration. No new EF migration is needed.

`ffprobe` must be on the API process PATH, or set `FfprobePath` to its absolute
executable path. FFmpeg is included in the API Docker runtime and installed in
the CI test job. The current local machine already has ffprobe installed.
The API needs temporary disk space and host/proxy upload limits sufficient for
the configured file size plus multipart overhead (maximum request 129 MiB).

## Data and playback

The authenticated API buffers the bounded file to temporary disk, verifies the
container/codec and duration using ffprobe, and streams it to Storage with a
SHA-256 checksum. Probe access is restricted to local files and MP3/MP4 containers
with a timeout; no URLs/playlists are accepted. Files are not transcoded to HLS:
playback is progressive MP3/M4A delivery through the CDN, with range/seek support
provided by the CDN and player.

No database record exists before explicit confirmation of a successful transfer.
The encrypted ticket binds metadata and target revision to the authenticated
editor. Finalization is idempotent and runs as one retryable database transaction
with a fresh context per attempt. Every replacement creates a new asset and
revision. Source files and published media snapshots are never overwritten.
Duration is read on the server, not accepted from the browser.

New sessions use `primaryAssetId` to atomically bind ready audio to the first
revision. Invalid/missing metadata cannot create ready media. Existing session
uploads require an audio session and the expected latest revision. Conflicts allow
saving only to the library without changing the session. Cancelling before
confirmation creates no local asset; remote orphan cleanup remains outside MVP.
Transfers are not resumed after reload. Locally confirmed library assets can
remain unassigned if a new form is abandoned.

Assets have no public audio URL. The existing authenticated playback endpoint
checks access in the active release and signs the exact object stored in that
release's media snapshot. It issues five-minute HMAC-SHA256 CDN URLs; applications
must request fresh authorization after expiry, including for subsequent seek or
resume requests. The Flutter player was not changed by this backoffice task.

## Endpoints and verification

- `GET /api/v1/admin/media/audio-uploads/configuration`
- `POST /api/v1/admin/media/audio-uploads` (multipart file/name and optional
  resource ID + expected revision together)
- `POST /api/v1/admin/media/audio-uploads/complete` (ticket, optional saveToLibrary)
- Existing `GET /api/v1/me/playback/{locale}/resources/{resourceKey}` for authorized playback

After configuring TEST: upload a real recording, confirm, save the audio session,
publish, and request playback as an entitled user. Confirm unsigned CDN requests
fail, valid signed requests succeed, expired/tampered tokens fail, and an
unentitled user cannot obtain a signed URL. Check replacement leaves the previous
published URL unchanged until a new release is activated.

Automated tests cover real local MP3/M4A metadata, invalid input, separate paths,
token signing and scope, idempotency, stale revisions, initial session duration,
published snapshot resolution, access denial, admin authentication and UI flow.
Actual Bunny transfer/playback still requires the private audio configuration.

References:
- https://bunny.net/docs/storage/http
- https://bunny.net/docs/cdn/security/token-authentication/advanced
- https://ffmpeg.org/ffprobe.html
