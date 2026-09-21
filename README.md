# Lumina backoffice

React/Vite admin UI for the active .NET API. All lists and saves use the API;
there is no demonstration data or mock authentication mode.

## Local configuration

Create `.env.local` in `Lumina_backoffice` using `.env.example` as a template.

```dotenv
VITE_ENVIRONMENT=TEST
VITE_API_BASE_URL=http://localhost:5236
VITE_FIREBASE_API_KEY=<Firebase web app API key>
VITE_FIREBASE_APP_ID=<Firebase web app ID>
VITE_FIREBASE_AUTH_DOMAIN=lumina-staging-30a8a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lumina-staging-30a8a
```

The API URL is the server origin, without `/api/v1`. The local API launch
profile uses port 5236. Firebase values come from the Firebase console web
app settings and must match the API's `Firebase:ProjectId`. The local file is
ignored by Git. Vite variables are public browser configuration: never put a
service account, private key or provider secret in them.

Run `npm install`, then `npm run dev`. Restart Vite after changing configuration;
production configuration requires a new build. The login page checks
`/health/ready` and reports missing configuration and connection failures.

Enable the Google sign-in provider and authorize the frontend hostname in
Firebase Authentication. Use an account in the same Firebase project with
the `admin=true` custom claim. Claims must be assigned by the trusted admin
provisioning process; the frontend never grants access. Sign in again after
claim changes. Screen permissions come from `GET /api/v1/admin/me`.

For local API Development, loopback CORS origins are allowed by default.
Otherwise configure `Cors__AllowedOrigins__0` on the API with the frontend
origin, e.g. `http://127.0.0.1:5173`. HTTP 401 indicates an invalid/expired token
or mismatched Firebase project; 403 indicates insufficient admin access.

The current local setup has been populated from the existing staging web
configuration. Database contents are not reset by the frontend.

## Validation

`npm run test`, `npm run lint`, `npm run build`.

See [form editing](docs/form-editing.md) and
[API boundaries](docs/backoffice-api-gaps.md) for supported operations.

See [session video upload MVP](docs/session-video-upload-mvp.md) for server configuration, rollout prerequisites and supported behavior.

See [thumbnail image upload](docs/thumbnail-image-upload.md) for independent material/session image upload and Bunny Storage configuration.

See [session audio upload](docs/session-audio-upload.md) for the audio/ Storage folder, protected CDN setup, and audio upload configuration.

See [staging deployment](docs/staging-deployment.md) for the GitHub Actions,
Firebase Hosting, and Workload Identity Federation setup.
