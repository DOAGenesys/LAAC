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

## 13. SSO Provider Implementation
### 13.1 Environment & Prerequisites
- [x] Verify Node.js ≥ 18 and package manager (npm/yarn) are installed.
- [ ] Ensure NTP/chrony is configured to maintain clock skew < 10s.
- [ ] Set up TLS certificates for HTTPS (required by Genesys Cloud).

### 13.2 Dependencies Installation
- [x] Install SAML dependencies: `samlify`, `xml-crypto`, `xmlbuilder2`.
- [x] Install dev dependencies: `@types/node`, `nodemon`, `ts-node`.

### 13.3 Certificate Generation
- [x] Create `/certs` directory.
- [ ] Generate X.509 signing certificate and private key using OpenSSL.
- [ ] Obtain Genesys Cloud's certificate for verification.

### 13.4 SAML Configuration
- [x] Create `src/lib/saml/config.ts` with IdP and SP configurations.

### 13.5 SAML API Endpoints
- [x] Create metadata endpoint: `src/pages/api/saml/metadata.ts`
- [x] Create SSO handler: `src/pages/api/saml/sso.ts`
- [x] Create Single Logout handler: `src/pages/api/saml/logout.ts`

### 13.6 Login UI
- [x] Create minimal React login page: `src/pages/login.tsx`
- [x] Implement authentication API: `src/pages/api/auth/verify.ts`
- [x] Add session management with secure cookies.

### 13.7 User Management
- [x] Implement user storage mechanism (DB or static list for MVP).
- [x] Ensure user emails match between IdP and Genesys Cloud.

### 13.8 Assertion Building
- [x] Configure SAML response generation with required attributes:
  - [x] `email`
  - [x] `OrganizationName`
  - [x] `ServiceName` (optional)
- [x] Implement proper signature without encryption (per Genesys requirements).
- [x] Handle RelayState for SP-initiated authentication.

### 13.9 Genesys Cloud Configuration
- [ ] Configure Genesys Cloud Admin > Single Sign-on > Generic:
  - [ ] Upload IdP certificate
  - [ ] Set Issuer URI, Target URL, and Single Logout URI
  - [ ] Configure Single Logout Binding as HTTP Redirect
  - [ ] Set Name Identifier Format to EmailAddress
  - [ ] Map required attributes

### 13.10 Testing
- [x] Test metadata endpoint is accessible and valid.
- [x] Test SP-initiated authentication flow.
- [x] Test IdP-initiated authentication flow.
- [x] Test Single Logout functionality.
- [ ] Verify clock skew remains < 10s.

### 13.11 Security Review
- [ ] Ensure TLS 1.2+ is enforced.
- [x] Verify private key is properly protected.
- [ ] Check for any exposed secrets in client bundles.
- [x] Validate SAML message signatures.
- [x] Audit cookie security settings.

### 13.12 Documentation
- [x] Update README.md with SSO provider setup instructions.
- [x] Document environment variable requirements.
- [x] Add troubleshooting section for common SSO issues.

---


