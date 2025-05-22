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

1. **Generate X.509 Certificates**:
   ```bash
   # Create self-signed certificates (valid for 3 years)
   cd certs
   openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 1095 -out cert.pem -subj "/CN=idp.example.com"
   ```

2. **Configure Additional Environment Variables**:
   ```bash
   # SAML Identity Provider Configuration
   BASE_URL=https://your-laac-app.vercel.app
   IDP_ENTITY_ID=https://your-laac-app.vercel.app/api/saml/metadata
   GENESYS_SP_ENTITY_ID=urn:gc:your-org-name
   GENESYS_ACS=https://login.mypurecloud.com/saml
   GENESYS_SLO=https://login.mypurecloud.com/saml/logout
   GENESYS_ORG_SHORT=yourorg
   JWT_SECRET=your-secure-jwt-secret
   ```

3. **Configure Genesys Cloud**:
   - Go to **Admin** ► **Integrations** ► **Single Sign-on**
   - Click on **Generic SSO Provider** tab
   - Configure the following:
     - **Provider Name**: "LAAC Identity Provider"
     - **Provider Logo**: Upload your logo (SVG, ≤ 25 KB)
     - **Provider's Certificate**: Upload `cert.pem`
     - **Provider's Issuer URI**: Your `IDP_ENTITY_ID` value
     - **Target URL**: Your SSO endpoint (`BASE_URL` + `/api/saml/sso`)
     - **Single Logout URI**: Your logout endpoint (`BASE_URL` + `/api/saml/logout`)
     - **Single Logout Binding**: HTTP Redirect
     - **Name Identifier Format**: EmailAddress
   - Map the following attributes:
     - `email` → email of the Genesys Cloud user
     - `OrganizationName` → your organization short name (`GENESYS_ORG_SHORT`)
     - `ServiceName` → `directory` (redirects to the Collaborate client)

4. **Start Using LAAC as an IdP**:
   - Users will log in via the LAAC login page
   - Demo users (for testing):
     - admin@example.com / password123
     - user@example.com / password123

### SSO Provider Endpoints

LAAC exposes the following SAML endpoints:

- **Metadata**: `/api/saml/metadata` - XML configuration for Genesys Cloud
- **Single Sign-On**: `/api/saml/sso` - Handles authentication requests
- **Single Logout**: `/api/saml/logout` - Handles logout requests

### SSO Provider Security Notes

- LAAC signs all SAML assertions but does not encrypt them (per Genesys Cloud requirements)
- HTTPS (TLS 1.2+) is required for all SAML endpoints
- System clock skew between LAAC and Genesys Cloud must be less than 10 seconds
- User email addresses must match exactly between LAAC and Genesys Cloud

### SSO Architecture

LAAC uses a two-step authentication process:

1. **User Authentication via IdP**: The user is first authenticated through a SAML Identity Provider (IdP) configured in Genesys Cloud
2. **Application Authentication**: Once authenticated to Genesys Cloud, LAAC uses OAuth to establish its own secure connection to the Genesys Cloud APIs

The complete flow is:
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

