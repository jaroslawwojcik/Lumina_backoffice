# Thumbnail image upload

Materials and sessions have a separate **Obrazek kafelka** drop area in both
creation and editing forms. It operates independently of Stream video upload.
Supported files: PNG and JPEG, up to 10 MiB, at most 12,000 pixels per side and
40 megapixels. An editorial library name is required before transfer.

## Storage configuration

Create a dedicated Bunny Storage zone for each environment and connect a CDN
Pull Zone to it. Use the CDN hostname as the public base URL. These thumbnails
are public presentation images; do not use this zone for protected audio or
documents. The backend serves no image downloads; consumers load CDN URLs.

Set these values in **Lumina.Api** user secrets locally, or the server secret
manager/environment in deployments. Do not put any Storage credentials in Vite.

| .NET key | Environment variable | Example / meaning |
| --- | --- | --- |
| `BunnyStorage:ZoneName` | `BunnyStorage__ZoneName` | `lumina-images-test` |
| `BunnyStorage:AccessKey` | `BunnyStorage__AccessKey` | Storage zone password from its Access page; not a Stream/global API key |
| `BunnyStorage:Endpoint` | `BunnyStorage__Endpoint` | `https://storage.bunnycdn.com` for Frankfurt; use the region's actual endpoint |
| `BunnyStorage:PublicBaseUrl` | `BunnyStorage__PublicBaseUrl` | `https://YOUR-PULL-ZONE.b-cdn.net` (hostname only, no path) |
| `BunnyStorage:MaximumBytes` | `BunnyStorage__MaximumBytes` | `10485760`; configurable downward, hard cap 10 MiB |

Restart the API after configuration. Missing configuration disables only the
image upload control, not video upload or editing the rest of the form.
No additional database migration is required beyond the existing verified-media
migrations. The same Data Protection persistence requirements as video uploads
apply to the 48-hour confirmation tickets.

## Transfer and persistence

The browser posts multipart data to the authenticated admin API. For these small
images the API forwards the bytes to Storage over HTTPS with its server-only
AccessKey and a SHA-256 checksum header. It checks actual container signatures,
PNG chunk boundaries / JPEG frame headers, dimensions, MIME and byte limits;
it does not transcode or fully decode image pixels.

Every upload gets a unique object key under `thumbnails/`; existing files are
never overwritten. Only after successful provider transfer does the API issue an
encrypted, actor-bound confirmation ticket. Transfer alone writes no database
records. Explicit confirmation creates a ready asset, and for an existing
resource atomically replaces the default thumbnail slot and creates a revision.
Retries of the same confirmation return the same asset/revision.

For a new form the confirmed image is saved to the library; `thumbnailAssetId`
in the create command binds it atomically to the first revision. Abandoning the
form after confirmation can leave an unassigned library asset. Cancellation
before confirmation can leave a remote Storage object, but no local asset.
Automatic orphan cleanup and transfer recovery after reload remain outside MVP.

Video and other revision media remain unchanged. A stale revision causes a
conflict; the editor can save the image only to the library and assign it after
refreshing. Published catalog cards resolve thumbnail URLs from the selected
revision's immutable media snapshot, so draft replacement becomes public only
after a new release is published.

## Endpoints

- `GET /api/v1/admin/media/image-uploads/configuration`
- `POST /api/v1/admin/media/image-uploads`: multipart `file`, `displayName`,
  optional `resourceId` and `expectedRevisionId` together.
- `POST /api/v1/admin/media/image-uploads/complete`: JSON `ticket` and optional
  `saveToLibrary`.

All endpoints require the existing verified Firebase admin policy. No anonymous
upload endpoint is exposed. Do not log confirmation tickets or Storage AccessKey.

## Verification

Upload a small real PNG/JPEG, confirm it, save a new material, and verify the CDN
preview. Publish its revision and verify the catalog thumbnail URL. Replace the
image and verify that the earlier published revision still has its original URL.
Also check cancellation, invalid formats, oversized images and stale revisions.
Provider transfer needs the environment-specific Storage configuration; automated
tests use an HTTP test double and an isolated PostgreSQL database.

Reference: https://bunny.net/docs/storage/http
