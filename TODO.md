## 0. Pre-Project Bootstrap
- [x] Read `PRD.md` end-to-end and raise questions if any.
- [x] Fork / clone the repository.

## 1. Environment & Secrets
- [x] Install Node ≥ 18 and pnpm / npm.
- [x] Create `.env.local` with **all** required keys:
  - [x] `NEXT_PUBLIC_GC_REGION`
  - [x] `NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID`
  - [x] `GC_CC_CLIENT_ID`
  - [x] `GC_CC_CLIENT_SECRET`
  - [x] `LAAC_COMPLIANT_COUNTRY`
  - [x] `LAAC_COMPLIANT_DIVISION_ID`
  - [x] `LAAC_NON_COMPLIANT_DIVISION_ID`
- [x] Remember: only `NEXT_PUBLIC_*` keys are exposed to the browser :contentReference[oaicite:0]{index=0}.
- [x] Add server-only vars to Vercel or GitHub secrets :contentReference[oaicite:1]{index=1}.

## 2. Genesys Cloud Configuration
- [x] In Admin ► Org Settings ► Authentication, toggle **Disable Genesys Cloud Login** ON :contentReference[oaicite:2]{index=2}.
- [x] Confirm your SAML IdP app has ACS URL `https://login.${REGION}/saml`.
- [x] Create an **Implicit-Grant** OAuth client for the front-end; copy its Client ID & redirect URI :contentReference[oaicite:3]{index=3}.
- [x] Create a **Client-Credentials** OAuth client for the back-end; copy its ID & secret :contentReference[oaicite:4]{index=4}.
- [x] Note compliant / non-compliant division UUIDs for env vars.

## 3. Project Skeleton
- [x] `npx create-next-app@latest --typescript` scaffold :contentReference[oaicite:5]{index=5}.
- [x] Install dependencies:
  - [x] `purecloud-platform-client-v2` JS SDK :contentReference[oaicite:6]{index=6}
  - [x] `swr`, `axios`
  - [x] `cypress` (dev)
- [x] Initial commit.

## 4. Front-End Implementation
### 4.1 SDK Bootstrap
- [x] Build `/lib/genesysSdk.ts` exporting `platformClient.ApiClient.instance` :contentReference[oaicite:7]{index=7}.

### 4.2 Auth Page (`/pages/index.tsx`)
- [x] If no `access_token` in URL, run `client.loginImplicitGrant(clientId, redirectUri)` :contentReference[oaicite:8]{index=8}.

### 4.3 Callback Page (`/pages/callback.tsx`)
- [x] Parse hash fragment for `access_token` (Implicit-grant) :contentReference[oaicite:9]{index=9}.
- [x] Fetch `GET /api/v2/users/me?expand=geolocation,null`.
- [x] Decide compliance vs non-compliance.
- [x] If current division differs, POST `/api/division-switch`.
- [x] Finally `window.location.href = https://apps.${REGION}`.

## 5. API Route (`/pages/api/division-switch.ts`)
- [x] Validate `{ userId, targetDivisionId }` payload.
- [x] Exchange Client-Credentials for bearer token :contentReference[oaicite:10]{index=10}.
- [x] POST `/authorization/divisions/{divisionId}/objects/USER` with `[userId]` :contentReference[oaicite:11]{index=11}.
- [x] Return `{ updated: true|false }`.

## 6. Error Handling & Edge Cases
- [x] Treat missing `geolocation` as non-compliant.
- [x] Gracefully degrade if API route fails.
- [x] Ensure host clock sync (< 10 s skew) for SAML :contentReference[oaicite:12]{index=12}.

## 7. Testing
### 7.1 Unit
- [x] Jest + ts-jest setup; mock SDK.

### 7.2 Integration
- [x] Test API route with mocked fetch.

### 7.3 E2E
- [x] Cypress specs for compliant, non-compliant, already-correct flows :contentReference[oaicite:13]{index=13}.

## 8. CI / CD
- [x] Deploy to Vercel on merge to `main` (to be done manually the first time) :contentReference[oaicite:14]{index=14}.

## 9. Observability
- [x] Add log drain / monitoring for API route errors.
- [x] Emit custom metric `division_switch_applied`.

## 10. Documentation
- [x] Update `README.md` with setup & env instructions.
- [x] Embed IdP configuration steps.

## 11. Security Review
- [x] Verify `GC_CC_CLIENT_SECRET` does **not** appear in client bundle.
- [x] `npm audit` & patch.

## 12. Deployment
- [x] Create Vercel project, add prod env vars, trigger deploy (to be done manually the first time).
- [x] Smoke-test live flow end-to-end.


---


