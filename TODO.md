## 0. Pre-Project Bootstrap
- [ ] Read `PRD.md` end-to-end and raise questions if any.
- [ ] Fork / clone the repository.

## 1. Environment & Secrets
- [ ] Install Node ≥ 18 and pnpm / npm.
- [ ] Create `.env.local` with **all** required keys:
  - [ ] `NEXT_PUBLIC_GC_REGION`
  - [ ] `NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID`
  - [ ] `GC_CC_CLIENT_ID`
  - [ ] `GC_CC_CLIENT_SECRET`
  - [ ] `LAAC_COMPLIANT_COUNTRY`
  - [ ] `LAAC_COMPLIANT_DIVISION_ID`
  - [ ] `LAAC_NON_COMPLIANT_DIVISION_ID`
- [ ] Remember: only `NEXT_PUBLIC_*` keys are exposed to the browser :contentReference[oaicite:0]{index=0}.
- [ ] Add server-only vars to Vercel or GitHub secrets :contentReference[oaicite:1]{index=1}.

## 2. Genesys Cloud Configuration
- [ ] In Admin ► Org Settings ► Authentication, toggle **Disable Genesys Cloud Login** ON :contentReference[oaicite:2]{index=2}.
- [ ] Confirm your SAML IdP app has ACS URL `https://login.${REGION}/saml`.
- [ ] Create an **Implicit-Grant** OAuth client for the front-end; copy its Client ID & redirect URI :contentReference[oaicite:3]{index=3}.
- [ ] Create a **Client-Credentials** OAuth client for the back-end; copy its ID & secret :contentReference[oaicite:4]{index=4}.
- [ ] Note compliant / non-compliant division UUIDs for env vars.

## 3. Project Skeleton
- [ ] `npx create-next-app@latest --typescript` scaffold :contentReference[oaicite:5]{index=5}.
- [ ] Install dependencies:
  - [ ] `purecloud-platform-client-v2` JS SDK :contentReference[oaicite:6]{index=6}
  - [ ] `swr`, `axios`
  - [ ] `cypress` (dev)
- [ ] Initial commit.

## 4. Front-End Implementation
### 4.1 SDK Bootstrap
- [ ] Build `/lib/genesysSdk.ts` exporting `platformClient.ApiClient.instance` :contentReference[oaicite:7]{index=7}.

### 4.2 Auth Page (`/pages/index.tsx`)
- [ ] If no `access_token` in URL, run `client.loginImplicitGrant(clientId, redirectUri)` :contentReference[oaicite:8]{index=8}.

### 4.3 Callback Page (`/pages/callback.tsx`)
- [ ] Parse hash fragment for `access_token` (Implicit-grant) :contentReference[oaicite:9]{index=9}.
- [ ] Fetch `GET /api/v2/users/me?expand=geolocation,null`.
- [ ] Decide compliance vs non-compliance.
- [ ] If current division differs, POST `/api/division-switch`.
- [ ] Finally `window.location.href = https://apps.${REGION}`.

## 5. API Route (`/pages/api/division-switch.ts`)
- [ ] Validate `{ userId, targetDivisionId }` payload.
- [ ] Exchange Client-Credentials for bearer token :contentReference[oaicite:10]{index=10}.
- [ ] POST `/authorization/divisions/{divisionId}/objects/USER` with `[userId]` :contentReference[oaicite:11]{index=11}.
- [ ] Return `{ updated: true|false }`.

## 6. Error Handling & Edge Cases
- [ ] Treat missing `geolocation` as non-compliant.
- [ ] Gracefully degrade if API route fails.
- [ ] Ensure host clock sync (< 10 s skew) for SAML :contentReference[oaicite:12]{index=12}.

## 7. Testing
### 7.1 Unit
- [ ] Jest + ts-jest setup; mock SDK.

### 7.2 Integration
- [ ] Test API route with mocked fetch.

### 7.3 E2E
- [ ] Cypress specs for compliant, non-compliant, already-correct flows :contentReference[oaicite:13]{index=13}.

## 8. CI / CD
- [ ] Deploy to Vercel on merge to `main` :contentReference[oaicite:14]{index=14}.

## 9. Observability
- [ ] Add log drain / monitoring for API route errors.
- [ ] Emit custom metric `division_switch_applied`.

## 10. Documentation
- [ ] Update `README.md` with setup & env instructions.
- [ ] Embed IdP configuration steps.

## 11. Security Review
- [ ] Verify `GC_CC_CLIENT_SECRET` does **not** appear in client bundle.
- [ ] `npm audit` & patch.

## 12. Deployment
- [ ] Create Vercel project, add prod env vars, trigger deploy.
- [ ] Smoke-test live flow end-to-end.

## 13. Post-Deploy
- [ ] Monitor logs for 24 h.
- [ ] Hand off to GC Admin for functional confirmation.
- [ ] Tag `v1.0.0` in git.

## 14. Future Enhancements (Backlog)
- [ ] Switch to Auth-Code + PKCE when SDK adds first-class support :contentReference[oaicite:15]{index=15}.
- [ ] Allow multi-country compliance list.
- [ ] Cache `/users/me` result per session.

---
*☐ = not started  · ☑ = done*
