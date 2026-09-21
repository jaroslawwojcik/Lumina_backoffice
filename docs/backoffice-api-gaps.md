# Backoffice API boundaries

The active backend is Lumina_api (.NET/PostgreSQL). The local Development
OpenAPI at /openapi/v1.json was checked against the frontend integration.

## Available operations

Admin identity and permissions, resource list/detail/revision history,
session/material creation and immutable revisions, program creation and
section editing/ordering, media registration and assignment, release
build/activation, product and price editing, and user/access/order/progress
reads are implemented. All use authenticated HTTP; failed reads never return
demonstration data.

## Remaining write gaps

- User profile updates have no admin write endpoint.
- Existing program metadata and canonical resource translations/access data
  have no update endpoint exposed by this UI contract.
- Existing asset metadata has no update endpoint; registration and resource
  assignment/replacement are supported.
- Revision snapshots do not update canonical catalog metadata or live releases.

Adding these operations requires backend commands and authorization, field
validation, concurrency handling and focused tests. No database migration or
new model was introduced for this integration.

## Contract adjustments

New content and release composition default to `pl`, matching current API
seed locales. `pl` and `pl-pl` are different translations, not interchangeable.
Nullable command properties are sent explicitly as null, including optional
text, program estimates, revision notes and price end dates. The resource
list uses the API query parameter `resourceType`.

A versioned OpenAPI artifact and automated contract-drift check remain useful
follow-up work. Current admin authorization requires a verified Firebase token
with admin=true; permissions are read from /api/v1/admin/me.
