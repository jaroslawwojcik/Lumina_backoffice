# Form editing

The backoffice exposes typed fields with inline validation and JSON inspection.

| Surface | Editable operations | JSON |
| --- | --- | --- |
| Sessions and materials | Creation and immutable revision creation | Bidirectional revision editor plus command preview on creation |
| Programs | Creation, section titles/descriptions, resource selection, optional/access flags and ordering | Creation data, section draft and current program |
| Media | Provider asset registration and resource assignment/replacement | Registration and assignment payloads |
| Products and prices | Product metadata, activity, positive PLN amounts and UTC price intervals | Draft payloads with amounts converted to grosze |
| Releases | Locale and selection of server-confirmed revisions | Build request |
| Users | Current API is read-only | Profile fields and profile JSON |

Revision fields and raw JSON share one state. Invalid JSON is preserved for
correction; typed editing resumes once an object can be parsed. Known fields
are validated on save, including changes made directly in JSON. Unknown
properties, nested objects and arrays are preserved. Empty optional values
remain absent or null rather than being silently coerced to zero.

Canonical resource metadata is separate from immutable revision snapshots.
Revision creation does not update the catalog title, translation, access tier
or live release. Existing program metadata, registered assets, and user
profiles cannot be updated through the current API. The UI does not simulate
successful production saves for these missing operations. Add application
commands, authorization, concurrency and backend tests before enabling them.

All reads and writes require the configured API and real Firebase authentication. No demonstration fallback remains. Tests cover field validation, JSON synchronization, API serialization, authenticated transport and failure propagation.
