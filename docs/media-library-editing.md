# Media library editing and verification

The library supports server-side kind filtering, editing, inline protected playback,
and the existing video/audio/image upload flows. Video registration uses Bunny Stream;
audio uploads use protected Bunny Storage and server-probed duration. Images use the
existing image upload and validation flow. Documents, subtitles and transcripts retain
manual registration.

## Repair an existing unverified video

1. Open **Media → Edytuj** and enter a library display name and the Bunny video UUID.
2. Choose **Pobierz i zapisz metadane z Bunny**. An empty library ID uses the server's
   configured Bunny Stream library. A different library is rejected by the gateway.
3. The API checks Bunny's status, duration, dimensions and size. Processing or failed
   files remain unverified. The UI displays the returned authoritative metadata.
4. Verification appends a new revision for currently assigned resources when their
   media snapshots differ. Published and older revisions remain untouched.
5. Select the latest revisions in a new release. If the video has not been assigned,
   assign it as the session's primary medium first.

Manual duration is not proof of readiness. Ready assets permit editorial renaming;
changing the underlying file requires a new asset and a new content revision.

## API changes

- `GET /api/v1/admin/assets?kind=video` filters before cursor pagination.
- Registration accepts optional `displayName`, `providerLibraryId`, `verifyProvider`.
  The last flag fetches provider metadata for Bunny Stream videos.
- `PUT /api/v1/admin/assets/{id}` edits metadata or verifies a video using the same
  payload. Provider-confirmed fields cannot be overwritten manually.
- `POST /api/v1/admin/assets/{id}/preview` issues ten-minute playback authorization
  to authenticated administrators. Responses are not cached; signing credentials
  never reach the browser. Authorization uses the asset's own library or storage zone.
- Media publication validation returns HTTP 422 with a Polish explanation and the
  affected `resourceId` and `revisionId`, instead of HTTP 500.

Video upload/verification requires `BunnyUpload` configuration; playback requires the
existing matching `Bunny` playback settings. Audio and image upload retain their existing
server configuration. No database migration is required.
