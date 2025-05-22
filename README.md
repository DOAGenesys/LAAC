# LAAC (Location-Aware Access Control)

LAAC is a Next.js web application that enforces division assignment based on user geolocation in Genesys Cloud.

## Overview

This application:
- Enforces SSO-only login for Genesys Cloud
- Determines user country by checking `geolocation.country` via the Genesys Cloud API
- Assigns users to the correct division based on their location
- Redirects to the Genesys Cloud UI after processing

## Single Sign-On (SSO) Integration

LAAC supports two SSO integration modes:

1. **SSO Client Mode** (original functionality):
   - Acts as an OAuth client to Genesys Cloud
   - Authenticates users via Genesys Cloud's configured SAML IdP
   - Determines user location and enforces division assignment

2. **SSO Provider Mode** (new functionality):
   - Acts as a SAML Identity Provider (IdP) for Genesys Cloud
   - Authenticates users directly in LAAC
   - Provides SAML assertions to Genesys Cloud
   - Supports both SP-initiated and IdP-initiated flows

### SSO Provider Setup

To use LAAC as a SAML Identity Provider for Genesys Cloud:

1. **Certificate Requirements and Generation**:

    The LAAC IdP requires X.509 certificates for signing SAML assertions. The `certs` directory in the project root should contain:
    *   `key.pem`: Your IdP's private key. **Keep this secure and never commit it to version control.**
    *   `cert.pem`: Your IdP's public certificate. This is what you'll upload to Genesys Cloud.
    *   `genesys-signing.crt`: Genesys Cloud's public certificate. This is used by LAAC to verify responses from Genesys Cloud (if applicable to your flows, less critical when LAAC is the IdP).
        *   To get this, go to **Admin > Single Sign-on > Generic SSO Provider** in Genesys Cloud.
        *   Under "Genesys Cloud Signing Certificate", click "Download Certificate".
        *   Save the file (likely as `genesys.cer`) and rename it to `genesys-signing.crt` in the `certs` directory.

    **Generate your IdP's `key.pem` and `cert.pem` (Using OpenSSL Recommended):**
    ```bash
    # Navigate to your project's certs directory
    cd certs

    # Generate a 2048-bit RSA private key and a self-signed public certificate
    # Replace laac.vercel.app with your actual IdP hostname if different
    openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 1095 -out cert.pem -subj "/CN=laac.vercel.app"
    ```
    **Important Security Notes for Certificates**:
    *   The private key (`key.pem`) is highly sensitive.
    *   For production, consider using certificates signed by a trusted Certificate Authority (CA).
    *   Self-signed certificates are generally acceptable for SAML IdP signing as the trust is established by uploading the public cert to the SP.
    *   Certificates have an expiration date (the command above sets it to 3 years). Monitor and renew them accordingly.

2. **Configure Environment Variables**:

    Add the following variables to your `.env.local` file and your hosting environment (e.g., Vercel):
    ```bash
    # --- SAML Identity Provider Configuration (LAAC as IdP) ---
    # Base URL of your LAAC application
    BASE_URL=https://laac.vercel.app
    # Entity ID for your LAAC IdP (conventionally the metadata URL)
    IDP_ENTITY_ID=https://laac.vercel.app/api/saml/metadata
    # JWT Secret for LAAC's internal user session management
    JWT_SECRET=your-very-strong-unique-and-secret-jwt-key # IMPORTANT: Generate a strong random string

    # --- Genesys Cloud Service Provider Configuration ---
    # Entity ID for your Genesys Cloud org (replace 'testdrivetest' with your actual org short name)
    GENESYS_SP_ENTITY_ID=urn:gc:testdrivetest
    # Assertion Consumer Service (ACS) URL for your Genesys Cloud region
    # (e.g., https://login.mypurecloud.ie/saml for Ireland, adjust if your region is different)
    GENESYS_ACS=https://login.mypurecloud.ie/saml
    # Single Logout (SLO) URL for your Genesys Cloud region
    GENESYS_SLO=https://login.mypurecloud.ie/saml/logout
    # Your Genesys Cloud organization's short name
    GENESYS_ORG_SHORT=testdrivetest
    ```
    *   **Note on `NEXT_PUBLIC_GC_REGION`**: The `GENESYS_ACS` and `GENESYS_SLO` URLs depend on your Genesys Cloud region. Ensure these match the region specified in `NEXT_PUBLIC_GC_REGION` (e.g., `mypurecloud.ie` corresponds to the URLs above).

3. **Configure Genesys Cloud (Admin UI)**:
    *   Navigate to **Admin** > **Integrations** > **Single Sign-on**.
    *   Select the **Generic SSO Provider** tab.
    *   Fill in the configuration fields as follows:
        *   **Provider Name**: A descriptive name, e.g., "LAAC Application IdP".
        *   **Provider Logo**: (Optional) Upload your application's logo (SVG, max 25KB).
        *   **The Provider's Certificate**: Click **Select Certificates to upload** and choose the `cert.pem` file you generated (your IdP's public signing certificate).
        *   **The Provider's Issuer URI**: Enter the value of your `IDP_ENTITY_ID` environment variable (e.g., `https://laac.vercel.app/api/saml/metadata`).
        *   **Target URL**: Enter the Single Sign-On URL for your LAAC IdP. This is `BASE_URL` + `/api/saml/sso` (e.g., `https://laac.vercel.app/api/saml/sso`).
        *   **Single Logout URI**: Enter the Single Logout URL for your LAAC IdP. This is `BASE_URL` + `/api/saml/logout` (e.g., `https://laac.vercel.app/api/saml/logout`).
        *   **Single Logout Binding**: Select **HTTP Redirect**.
        *   **Relying Party Identifier**: Enter the value of your `GENESYS_SP_ENTITY_ID` (e.g., `urn:gc:testdrivetest`).
        *   **Name Identifier Format**: Select **EmailAddress**.
        *   **Endpoint Compression**: Leave this **unchecked**.
    *   Click **Save**.
    *   **Attribute Mapping**: After saving, configure SAML attribute mapping:
        *   `email` (from LAAC) → `email` (Genesys Cloud user's primary email)
        *   `OrganizationName` (from LAAC) → `urn:purecloud:organization:name` (or the attribute for org short name, matching `GENESYS_ORG_SHORT`).
        *   `ServiceName` (optional, from LAAC, e.g., "directory") → Can direct users to a specific Genesys Cloud app.

4. **Start Using LAAC as an IdP**:
    *   Users will log in via the LAAC login page (`/login`).
    *   Demo user (for local testing, defined in `src/lib/saml/userService.ts`):
        *   Email: `<demoEmail>`
        *   Password: `<redacted>`

### SSO Provider API Endpoints

LAAC, when acting as an IdP, exposes the following SAML endpoints:

*   **Metadata**: `GET /api/saml/metadata` - Publishes the IdP's XML metadata.
*   **Single Sign-On (SSO)**: `GET /api/saml/sso` - Handles authentication requests and initiates the SAML flow.
*   **Single Logout (SLO)**: `GET /api/saml/logout` - Handles logout requests.

### SSO Provider Security Considerations & Limitations

*   **HTTPS**: All LAAC IdP endpoints must be served over HTTPS (TLS 1.2+). Vercel handles this automatically.
*   **Clock Synchronization**: Ensure your LAAC server's clock (especially if self-hosting) is synchronized (e.g., via NTP). Skew >10s with Genesys Cloud can cause errors.
*   **User Email Matching**: The email address provided by LAAC in the SAML assertion *must exactly match* the email of an existing user in Genesys Cloud for the login to succeed.
*   **No Assertion Encryption**: LAAC signs SAML assertions but does not encrypt them, as per Genesys Cloud's general requirements for custom IdPs (since the channel is already TLS encrypted).
*   **Demo Implementation**: The current user store (`userService.ts`) is for demonstration only (static users). For production, integrate a proper database and user management system.
*   **Session Management**: LAAC uses JWTs in cookies for its internal user sessions. Ensure `JWT_SECRET` is strong and kept confidential.

### SSO Client Mode (Original Functionality)

This mode is still present and allows LAAC to act as an OAuth client to an *external* IdP that is already configured in Genesys Cloud.

#### SSO Client Architecture

LAAC uses a two-step authentication process:
1. User accesses LAAC application
2. LAAC redirects to Genesys Cloud OAuth page via the Implicit Grant flow
3. Genesys Cloud redirects to the IdP login page (if user isn't already logged in)
4. User authenticates with the IdP
5. IdP sends a SAML assertion back to Genesys Cloud
6. Genesys Cloud validates the SAML assertion and issues an OAuth token
7. User is redirected back to LAAC with the access token
8. LAAC uses the token to make API calls to get/set division assignment

### Identity Provider

The Identity Provider (IdP) is **not** part of this repository. It is:
- An external SAML 2.0 compliant service (like Okta, Azure AD, etc.) that is configured separately
- Managed through the Genesys Cloud Admin UI (Admin ► Org Settings ► Authentication ► Identity Provider)
- The source of truth for user identity and authentication

### SSO Code Dependencies

The LAAC application depends on these components for SSO:

1. **Genesys Cloud SDK (`purecloud-platform-client-v2`)**: Core dependency that handles:
   - OAuth flow initialization (`loginImplicitGrant` method)
   - Token management
   - API authentication

2. **Authentication Flow Files**:
   - `src/pages/index.tsx`: Initiates the OAuth process and redirects to Genesys Cloud
   - `src/pages/callback.tsx`: Processes the OAuth callback containing the access token
   - `src/lib/genesysSdk.ts`: Wrapper around the Genesys Cloud SDK that manages authentication

3. **Configuration**:
   - `NEXT_PUBLIC_GC_REGION`: Determines which Genesys Cloud environment to authenticate against
   - `NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID`: OAuth Client ID for the browser-based flow
   - `GC_CC_CLIENT_ID` and `GC_CC_CLIENT_SECRET`: For server-side API calls

### SSO Constraints

- LAAC does not handle user creation, password management, or IdP configuration
- LAAC expects SSO to be pre-configured and the native login option to be disabled in Genesys Cloud
- User attributes (including country/location) are pulled from Genesys Cloud, not directly from the IdP
- The application relies on Genesys Cloud's SSO integration capabilities, not direct IdP integration

### Testing SSO

For development and testing:
1. Ensure your Genesys Cloud org has a configured IdP
2. Make sure your test user exists in both the IdP and Genesys Cloud
3. The proper OAuth Redirect URIs must be configured (including localhost for testing)
4. Developer accounts may require additional permissions

## Prerequisites

- Node.js ≥ 18
- A Genesys Cloud organization with:
  - Administrator access
  - SAML IdP configured
  - Ability to create OAuth clients

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/laac.git
```

### 2. Install dependencies

```bash
npm install
```

### 3. Genesys Cloud Configuration

#### 3.1 Disable native login

1. Go to **Admin** ► **Org Settings** ► **Authentication**
2. Toggle **Disable Genesys Cloud Login** to **ON**

#### 3.2 Create OAuth Clients

**Implicit Grant Client (for browser)**:
1. Go to **Admin** ► **Integrations** ► **OAuth**
2. Click **Add Client**
3. Select **Implicit Grant (Browser)**
4. Enter a name (e.g., "LAAC Frontend")
5. Add redirect URI: `https://your-laac-app.vercel.app/callback` (Replace `your-laac-app.vercel.app` with your actual deployment URL)
6. Add scopes: `users:read`
7. Save the Client ID

**Client Credentials (for server API)**:
1. Go to **Admin** ► **Integrations** ► **OAuth**
2. Click **Add Client**
3. Select **Client Credentials**
4. Enter a name (e.g., "LAAC Backend")
5. Add scopes: `authorization:division:edit`
6. Save the Client ID and Secret

#### 3.3 Get Division IDs

1. Go to **Admin** ► **Account** ► **Divisions**
2. Note the IDs for:
   - LAAC-compliant division
   - Non-compliant division

### 4. Environment Configuration

Create a `.env.local` file in the `laac` directory with the following variables:

```bash
# Genesys Cloud Region (e.g. mypurecloud.com, mypurecloud.ie, etc.)
NEXT_PUBLIC_GC_REGION=mypurecloud.com

# OAuth Client ID for Implicit Grant (front-end)
NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID=your-implicit-client-id

# OAuth Client ID for Client Credentials (back-end)
GC_CC_CLIENT_ID=your-cc-client-id

# OAuth Client Secret for Client Credentials (back-end)
GC_CC_CLIENT_SECRET=your-cc-client-secret

# Location and Division Configuration
LAAC_COMPLIANT_COUNTRY=Switzerland
LAAC_COMPLIANT_DIVISION_ID=your-compliant-division-id
LAAC_NON_COMPLIANT_DIVISION_ID=your-non-compliant-division-id
```

### 5. Local Development

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### 6. Testing

```bash
# Run unit tests
npm test

# Run Cypress E2E tests (interactive)
npm run cypress

# Run Cypress E2E tests (headless)
npm run e2e:headless
```

## Deployment

### Vercel

1. Create a new project on Vercel
2. Link to your GitHub repository
3. Add all environment variables (including server-side secrets like `GC_CC_CLIENT_SECRET`)
4. Deploy

The `vercel.json` file in the is configured for Vercel deployments.

### Other Platforms

This is a standard Next.js application and can be deployed to any platform that supports Next.js.

## How It Works

1. User visits the app and is redirected to Genesys Cloud SSO login
2. After authentication, user returns to `/callback` with an access token
3. App fetches user details including country from Genesys Cloud API
4. Based on country, app determines if user should be in the compliant or non-compliant division
5. If user is not in the correct division, app makes a server-side API call to update the division
6. User is redirected to the Genesys Cloud UI

## Architecture

- **Frontend**: Next.js/React (Pages Router), TailwindCSS
- **Authentication**: Genesys Cloud Implicit Grant OAuth flow (browser), Client Credentials (server)
- **API**: Next.js API routes for server-side operations (`/api/division-switch`)
- **SDKs**: `purecloud-platform-client-v2` for Genesys Cloud interactions
- **State Management**: React Context, `sessionStorage` for access token (as per PRD, though current implementation directly uses URL hash for token)
- **Testing**: Jest for unit tests, Cypress for E2E tests
- **Logging**: Custom logger module (`src/lib/logger.ts`) for structured logging and metrics.

## Security Considerations

- No sensitive credentials in the client bundle (only `NEXT_PUBLIC_*` vars)
- Client-side token has minimal scopes (`users:read` only)
- Server-side token has minimal scopes (`authorization:division:edit` only)
- CORS protection via same-origin API routes
- A security verification script is available: `npm run security:verify` (run from `laac` directory). This script builds the app and scans client-side bundles for inadvertently exposed sensitive variables.
- Run `npm run security:audit` (from `laac` directory) to check for known vulnerabilities in dependencies.

## Observability

The application uses a custom logger (`src/lib/logger.ts`) which:
- Emits structured logs (JSON in production, readable in development).
- Emits custom metrics (e.g., `division_switch_applied`, `division_switch_skipped`, `division_switch_failed`, `division_switch_error`) which are currently logged to the console. This can be integrated with a monitoring system.
- Vercel function logs for the `/api/division-switch` endpoint provide additional insights.

## Troubleshooting

### Common Issues

- **SAML Login Failures**: Ensure host system has proper time sync (NTP, < 10s skew)
- **Division Switch Errors**: Verify OAuth client has proper scopes. Check server logs for details.
- **"User not found"**: Check that userId is valid and user exists in Genesys Cloud.
- **Missing Environment Variables**: Ensure all required variables are set in `.env.local` for local development and in Vercel (or your deployment platform) for deployed environments.

### Logs

Check Vercel logs (or your platform's logs) for API errors. The app emits structured logs and metrics for observability, as described above.

