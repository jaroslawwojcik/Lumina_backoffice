# Backoffice staging deployment

The deployment workflow expects this directory to be published as its own
GitHub repository. It runs linting, tests, and a production Vite build before
deploying to the dedicated Firebase Hosting site
`lumina-backoffice-staging` in project `lumina-staging-30a8a`.

Create a protected GitHub Environment named `staging` and add these public
configuration values as Environment variables:

- `FIREBASE_API_KEY`
- `FIREBASE_APP_ID`
- `FIREBASE_AUTH_DOMAIN` (`lumina-staging-30a8a.firebaseapp.com`)
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

The last two values must point to a Workload Identity Federation provider and
service account whose repository restriction matches the future backoffice
repository. Do not reuse a provider that is restricted to `Lumina_app`.

Create the Firebase Hosting site once before the first deployment:

```text
firebase hosting:sites:create lumina-backoffice-staging \
  --project lumina-staging-30a8a
```

Also add `lumina-backoffice-staging.web.app` and
`lumina-backoffice-staging.firebaseapp.com` to Firebase Authentication's
authorized domains. The API staging workflow already includes both origins in
its CORS configuration.

Vite `VITE_*` values are embedded in browser assets and therefore must contain
only public client configuration. Bunny, PayU, RevenueCat, database, service
account, and private Firebase credentials belong only in the backend secret
flow.
