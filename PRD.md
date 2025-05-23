## Product Requirements Document (PRD)

### 1. Overview
This document specifies a Next.js/TypeScript web application that:
- Enforces Single Sign-On (SSO)-only login for Genesys Cloud.
- On first authenticated load, reads the user's `geolocation.country` and current `division.id` via the Genesys Cloud `users/me` API.
- Compares against an environment-configured "LAAC compliant" country; if the user's division does not match the target, invokes a secure server API to reassign them to the correct division.
- Redirects the user to the Genesys Cloud UI (`https://apps.<REGION>`) once division assignment is verified or updated.
- Uses OAuth Implicit Grant in the browser (user context) and OAuth Client Credentials on the server (service context).
- Is fully driven by environment variables—no hard-coded regions, client IDs/secrets, or division IDs—so the same code supports any Genesys Cloud region.

### 2. Goals & Success Metrics
- **SSO-only login**: Users cannot authenticate with native Genesys passwords; only the configured SAML IdP is permitted.
- **Automated division assignment**: Zero-click compliance routing—users end up in the correct Genesys Cloud division based solely on their country.
- **Security**: No client-credentials secret in the browser; browser-issued token scoped to read-only profile access; server-issued token scoped only to division edits.
- **Configurability**: Switch countries or division IDs without code changes; simply update environment variables.
- **Reliability**: <1% error rate on division-switch endpoint; end-to-end login & redirect must complete <3 seconds under normal conditions.

### 3. Architecture & Tech Stack
- **Framework**: Next.js 15 with Pages Router, TypeScript  
- **Front-end OAuth**: Genesys Cloud JS SDK (`loginImplicitGrant`)  
- **Back-end OAuth**: Direct fetch to `/oauth/token` with client_credentials  
- **API Routes**: Next.js API (`/api/division-switch`)  
- **State Management**: React Context + `sessionStorage` for `access_token`  
- **CI/CD**: Vercel (secrets stored in repo/org settings)  
- **Monitoring**: Vercel Logs + custom metrics for division-switch successes/failures  

### 4. Environment Variables
| Name                                | Exposure       | Description                                                  |
|-------------------------------------|----------------|--------------------------------------------------------------|
| `NEXT_PUBLIC_GC_REGION`             | Browser        | Genesys Cloud region (e.g., `mypurecloud.com`)              |
| `GC_CC_CLIENT_ID`                    | Server         | Genesys Cloud OAuth client ID for Client Credentials        |
| `GC_CC_CLIENT_SECRET`                | Server         | Genesys Cloud OAuth client secret for Client Credentials    |
| `LAAC_COMPLIANT_DIVISION_ID`         | Server         | Division ID for compliant users                              |
| `LAAC_NON_COMPLIANT_DIVISION_ID`     | Server         | Division ID for non-compliant users                          |
| `GEOCODE_API_KEY`                    | Server         | API key for geocoding service                                |

These environment variables enable the core LAAC functionality:

```bash
# Required variables for production deployment
NEXT_PUBLIC_GC_REGION,
GC_CC_CLIENT_ID,
GC_CC_CLIENT_SECRET,
LAAC_COMPLIANT_DIVISION_ID,
LAAC_NON_COMPLIANT_DIVISION_ID,
GEOCODE_API_KEY
```

### 5. Detailed Flow

#### 5.1 Front-end Login & Token Acquisition
1. **`/pages/index.tsx`**  
   - Checks for `access_token` in URL fragment.  
   - If absent, calls `platformClient.ApiClient.instance.loginImplicitGrant(
      NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID,
      window.location.origin + '/callback'
     )`.

2. **SSO Redirect**  
   - User is sent to `https://login.<REGION>`.  
   - Because native login is disabled, only SAML IdP selection appears.  
   - Upon success the browser returns to `/callback#access_token=…`.

#### 5.2 Compliance Check & Decision
3. **`/pages/callback.tsx`**  
   - Parses `access_token` from fragment.  
   - Sets SDK bearer token.  
   - Fetches `GET https://api.<REGION>/api/v2/users/me?expand=geolocation`.  
   - Extracts:
     - `userId = response.id`  
     - `country = response.geolocation?.country ?? ''`  
     - `currentDivision = response.division.id`

4. **Target Division Determination**  
   ```ts
   const targetDivision = (country === LAAC_COMPLIANT_COUNTRY)
     ? LAAC_COMPLIANT_DIVISION_ID
     : LAAC_NON_COMPLIANT_DIVISION_ID;
   ```

5. **Skip or Switch**
   * If `currentDivision === targetDivision`, skip update.
   * Otherwise, call server API.

#### 5.3 Back-end Division-Switch API

6. **`/pages/api/division-switch.ts`**
   * Accepts `POST { userId, targetDivisionId }`.
   * Exchanges `GC_CC_CLIENT_ID` + `GC_CC_CLIENT_SECRET` at
     `https://login.<REGION>/oauth/token` for a service token.
   * Calls
     `POST https://api.<REGION>/api/v2/authorization/divisions/{targetDivisionId}/objects/USER`
     with body `["userId"]`.
   * Returns JSON `{ updated: boolean }`.

#### 5.4 Final Redirect

7. After receiving `{ updated }`, client immediately does:
   ```js
   window.location.href = `https://apps.${NEXT_PUBLIC_GC_REGION}`;
   ```

### 6. Folder Structure

```
/src
├── /pages
│   ├── index.tsx            # Initiate Implicit Grant
│   └── callback.tsx         # Token parse, compliance logic, redirect
├── /pages/api
│   └── division-switch.ts   # Server-side division assignment
├── /lib
│   ├── genesysSdk.ts        # SDK singleton & config
│   └── oauthService.ts      # Client-Cred token helper
└── /types
    └── genesys.ts           # TS interfaces for API responses
```

### 7. Error Handling & Edge Cases

* **No `geolocation`** → treat as non-compliant.
* **Same division** → skip API call.
* **API errors (4xx/5xx)** → log on server; respond `{ updated: false }`; client still redirects.
* **Clock skew**: Host must run NTP (<10s skew) or SAML login may fail.

### 8. Testing Strategy

* **Unit tests** (Jest + ts-jest):
  * Mock SDK's `loginImplicitGrant`.
  * Test compliance logic.
* **Integration tests**:
  * Next.js API route with mocked fetch responses.
* **E2E tests** (Cypress):
  * Simulate compliant vs non-compliant users; assert redirection and API hits.

### 9. Deployment

* **Vercel**:
  * Automatic on merge to `main`.
  * Env vars injected via Vercel Dashboard.
  * Rollback via Vercel's one-click revert.

### 10. Monitoring & Metrics

* **Logs**: Vercel function logs for `/api/division-switch`.
* **Metrics**: custom event `division_switch` with tags: `country`, `updated:boolean`.
* **SLO**: 99% successful redirects & division-switches over rolling 7-day window.

### 11. Security & Compliance

* **Secrets**:
  * Only `NEXT_PUBLIC_*` in browser bundle.
  * `GC_CC_CLIENT_SECRET` resides in secure env only.
* **OAuth scopes**:
  * Implicit grant: `users.read` only.
  * Client credentials: `authorization:division:edit` only.
* **CORS**:
  * API route is same-origin; no external CORS allowed.
