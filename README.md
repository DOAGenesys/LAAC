# LAAC (Location-Aware Access Control)

LAAC is a Next.js web application that enforces division assignment based on user geolocation in Genesys Cloud.

## Overview

This application:
- Enforces SSO-only login for Genesys Cloud
- Determines user country using HTML5 browser geolocation and backend geocoding API
- Assigns users to the correct division based on their location
- Integrates LAAC control before completing SSO login to Genesys Cloud

## LAAC Workflow

The Location-Aware Access Control process follows this workflow:

1. **Entry Point**: User visits the main page (`https://your-laac-app.vercel.app`)
2. **Authentication Check**: 
   - If no access token exists, redirects to login page
   - If access token exists (in URL hash or session), proceeds to LAAC process
3. **Login Options** (`/login`):
   - **IdP Authentication**: User authenticates with LAAC's identity provider
   - **Direct SSO**: User authenticates directly with Genesys Cloud SSO
4. **OAuth Flow**: After authentication, Genesys Cloud redirects with access token to LAAC process
5. **LAAC Processing** (`/laac`):
   - **Geolocation**: Uses HTML5 browser geolocation API to get coordinates
   - **Geocoding**: Converts coordinates to country using backend geocoding API (which calls geocode.maps.co)
   - **User Search**: Finds user in Genesys Cloud by email using server-side API
   - **Division Assignment**: Updates user division based on location compliance
   - **SSO Completion**: Redirects to complete SAML SSO flow
6. **Genesys Cloud Access**: User is logged into Genesys Cloud with correct division assignment

### Location Compliance Rules

- Users who grant location permissions and are in the compliant country → Assigned to compliant division
- Users who deny location permissions or are in non-compliant countries → Assigned to non-compliant division
- Location check happens **before** SSO completion to ensure proper division assignment

## Single Sign-On (SSO) Integration

LAAC supports two SSO integration modes:

1. **SSO Client Mode** (Enhanced with LAAC):
   - Acts as an OAuth client to Genesys Cloud
   - Integrates HTML5 geolocation-based LAAC process before SSO completion
   - Determines user location and enforces division assignment

2. **SSO Provider Mode** (SAML IdP functionality):
   - Acts as a SAML Identity Provider (IdP) for Genesys Cloud
   - Authenticates users directly in LAAC
   - Provides SAML assertions to Genesys Cloud
   - Supports both SP-initiated and IdP-initiated flows

### SSO Provider Setup

To use LAAC as a SAML Identity Provider for Genesys Cloud:

1. **Certificate Requirements**:

    The LAAC IdP requires X.509 certificates for signing SAML assertions. Add the following environment variables:
    *   `SAML_SIGNING_KEY`: Your IdP's private key. **Keep this secure and never expose it to the client.**
    *   `SAML_SIGNING_CERT`: Your IdP's public certificate. This is what you'll upload to Genesys Cloud.
    *   `SAML_GENESYS_CERT`: Genesys Cloud's public certificate. This is used by LAAC to verify responses from Genesys Cloud (if applicable to your flows, less critical when LAAC is the IdP).
        *   To get this, go to **Admin > Single Sign-on > Generic SSO Provider** in Genesys Cloud.
        *   Under "Genesys Cloud Signing Certificate", click "Download Certificate".
        *   Save the file (likely as `genesys.cer`) and open it in a text editor to copy its contents.

    **Generate your IdP's certificates (Using OpenSSL Recommended):**
    ```bash
    # Generate a 2048-bit RSA private key and a self-signed public certificate
    # Replace laac.vercel.app with your actual IdP hostname if different
    openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 1095 -out cert.pem -subj "/CN=laac.vercel.app"
    
    # Then open these files in a text editor to copy their contents to your environment variables
    # Be careful not to commit these certificates to version control!
    ```
    **Important Security Notes for Certificates**:
    *   The private key (`SAML_SIGNING_KEY`) is highly sensitive and should only be stored in secure environment variables.
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
    
    # --- SAML Certificates ---
    # Your IdP's private key (from key.pem)
    SAML_SIGNING_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----
    # Your IdP's public certificate (from cert.pem)
    SAML_SIGNING_CERT=-----BEGIN CERTIFICATE-----\nMIIDpT...\n-----END CERTIFICATE-----
    # Genesys Cloud's public certificate
    SAML_GENESYS_CERT=-----BEGIN CERTIFICATE-----\nMIIEET...\n-----END CERTIFICATE-----

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

    # --- Demo User Credentials ---
    DEMO_USER_EMAIL=your_demo_user@example.com
    DEMO_USER_PASSWORD=your_strong_password
    
    # --- LAAC Configuration ---
    # Geocoding API key for location services (backend only)
    GEOCODE_API_KEY=your-geocode-maps-co-api-key
    ```
    
    **Note on Certificate Format**: When adding the certificates to environment variables:
    - Ensure you include the entire content (including BEGIN/END lines).
    - Replace actual newlines with `\n` in the environment variable.
    - If using a .env file, you can use actual newlines by enclosing the value in double quotes and using backslashes at the end of each line.

3. **Configure Genesys Cloud (Admin UI)**:
    *   Navigate to **Admin** > **Integrations** > **Single Sign-on**.
    *   Select the **Generic SSO Provider** tab.
    *   Fill in the configuration fields as follows:
        *   **Provider Name**: A descriptive name, e.g., "LAAC Application IdP".
        *   **Provider Logo**: (Optional) Upload your application's logo (SVG, max 25KB).
        *   **The Provider's Certificate**: Click **Select Certificates to upload** and upload a file containing the text from your `SAML_SIGNING_CERT` environment variable (your IdP's public signing certificate).
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
    *   You can configure a demo user with the `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` environment variables.

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

### SSO Client Mode (Enhanced with LAAC)

This mode integrates the LAAC process with OAuth client functionality, providing location-aware access control before SSO completion.

#### Enhanced SSO Client Architecture

LAAC uses an enhanced authentication process:
1. User accesses LAAC application
2. **LAAC Entry Point**: Main page checks for existing authentication
3. **Login Options**: IdP authentication or direct Genesys Cloud SSO
4. **OAuth Flow**: Genesys Cloud OAuth via Implicit Grant flow
5. **LAAC Processing**: HTML5 geolocation, geocoding, user search, and division assignment
6. **SSO Completion**: SAML SSO completion and redirect to Genesys Cloud

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
   - `src/pages/index.tsx`: Entry point that routes to login or LAAC process
   - `src/pages/login.tsx`: Handles IdP authentication and OAuth initiation
   - `src/pages/laac.tsx`: Processes location-aware access control
   - `src/pages/callback.tsx`: Simplified OAuth callback handler
   - `src/lib/genesysSdk.ts`: Wrapper around the Genesys Cloud SDK

3. **Configuration**:
   - `NEXT_PUBLIC_GC_REGION`: Determines which Genesys Cloud environment to authenticate against
   - `GC_CC_CLIENT_ID` and `GC_CC_CLIENT_SECRET`: For server-side API calls
   - `GEOCODE_API_KEY`: API key for geocoding services (backend only)

### SSO Constraints

- LAAC does not handle user creation, password management, or IdP configuration
- LAAC expects SSO to be pre-configured and the native login option to be disabled in Genesys Cloud
- User location is determined using HTML5 geolocation API and external geocoding service
- The application relies on Genesys Cloud's SSO integration capabilities and API access

### Testing SSO

For development and testing:
1. Ensure your Genesys Cloud org has a configured IdP
2. Make sure your test user exists in both the IdP and Genesys Cloud
3. The proper OAuth Redirect URIs must be configured (including localhost for testing)
4. Developer accounts may require additional permissions
5. Test both geolocation permission scenarios (granted and denied)

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

**Client Credentials (for server API)**:
1. Go to **Admin** ► **Integrations** ► **OAuth**
2. Click **Add Client**
3. Select **Client Credentials**
4. Enter a name (e.g., "LAAC Backend")
5. Add scopes: `authorization:division:edit users:search`
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

# OAuth Client ID for Client Credentials (back-end)
GC_CC_CLIENT_ID=your-cc-client-id

# OAuth Client Secret for Client Credentials (back-end)
GC_CC_CLIENT_SECRET=your-cc-client-secret

# Location and Division Configuration
LAAC_COMPLIANT_COUNTRY=Switzerland
LAAC_COMPLIANT_DIVISION_ID=your-compliant-division-id
LAAC_NON_COMPLIANT_DIVISION_ID=your-non-compliant-division-id

# Geocoding API Configuration (backend only)
GEOCODE_API_KEY=your-geocode-maps-co-api-key
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
3. Add all environment variables (including server-side secrets like `GC_CC_CLIENT_SECRET` and `GEOCODE_API_KEY`)
4. Deploy

The `vercel.json` file in the is configured for Vercel deployments.

### Other Platforms

This is a standard Next.js application and can be deployed to any platform that supports Next.js.

## How It Works

The new LAAC workflow integrates location-aware access control before SSO completion:

1. **Entry Point**: User visits the application main page
2. **Authentication Check**: App checks for existing access token (URL hash or sessionStorage)
3. **Login Process**: If no token, user is redirected to login page with options for:
   - IdP authentication (internal LAAC identity provider)
   - Direct Genesys Cloud SSO
4. **OAuth Flow**: After authentication, Genesys Cloud redirects with access token to LAAC process
5. **LAAC Processing**: 
   - Extract and store access token
   - Request HTML5 browser geolocation (coordinates)
   - Convert coordinates to country using backend geocoding API (which calls geocode.maps.co)
   - Search for user in Genesys Cloud by email (server-side with client credentials)
   - Update user division based on location compliance rules
6. **SSO Completion**: Redirect to complete SAML SSO flow
7. **Genesys Cloud Access**: User is logged into Genesys Cloud with correct division assignment

### Location Compliance Logic

- **Compliant**: Users in the configured compliant country are assigned to the compliant division
- **Non-Compliant**: Users who deny location permissions or are in other countries are assigned to the non-compliant division
- **Security**: Location check happens before SSO completion to prevent bypassing LAAC controls

## Architecture

- **Frontend**: Next.js/React (Pages Router), TailwindCSS
- **Authentication**: Genesys Cloud Implicit Grant OAuth flow (browser), Client Credentials (server)
- **Location Services**: HTML5 Geolocation API, backend geocoding API
- **APIs**: 
  - `/api/division-switch` - Updates user division assignment
  - `/api/users/search` - Finds users by email in Genesys Cloud
  - `/api/geocode` - Converts latitude/longitude to country information (backend only)
  - `/api/saml/*` - SAML Identity Provider endpoints
- **SDKs**: `purecloud-platform-client-v2` for Genesys Cloud interactions
- **State Management**: React state, `sessionStorage` for token storage
- **Testing**: Jest for unit tests, Cypress for E2E tests
- **Logging**: Custom logger module (`src/lib/logger.ts`) for structured logging and metrics

## Security Considerations

- No sensitive credentials in the client bundle (only `NEXT_PUBLIC_*` vars)
- Geocoding API key is server-side only, not exposed to the frontend
- Client-side token has minimal scopes (`users:read` only)
- Server-side token has minimal scopes (`authorization:division:edit users:search`)
- Geolocation data processed client-side only, coordinates sent to backend geocoding API
- CORS protection via same-origin API routes
- **Clean HTTP Headers**: LAAC ensures no infrastructure headers (Vercel, proxy, etc.) are included in outgoing API calls to external services
- **Header Filtering**: All outgoing HTTP requests use clean, explicitly defined headers to prevent accidental forwarding of platform-specific metadata
- A security verification script is available: `npm run security:verify` (run from `laac` directory). This script builds the app and scans client-side bundles for inadvertently exposed sensitive variables.
- Run `npm run security:audit` (from `laac` directory) to check for known vulnerabilities in dependencies.

### HTTP Client Security

LAAC implements strict header filtering for all outgoing API calls:

- **Filtered Headers**: The application automatically filters out infrastructure headers like:
  - `x-vercel-*` (Vercel platform headers)
  - `x-forwarded-*` (Proxy headers)
  - `forwarded` (Proxy forwarding information)
  - `x-real-ip` (Original IP headers)
  - `sec-*` (Browser security headers)
  - `host`, `connection`, `user-agent` (Request metadata)

- **Clean Headers Only**: Outgoing API calls include only explicitly defined headers:
  - `Content-Type`: For request body format
  - `Authorization`: For API authentication
  - `Accept`: For response format specification
  - `User-Agent`: Custom application identifier

- **Implementation**: The `src/lib/httpClient.ts` module provides utilities for making clean HTTP requests that prevent accidental header forwarding.

## Observability

The application uses a custom logger (`