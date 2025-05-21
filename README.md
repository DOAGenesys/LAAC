# LAAC (Location-Aware Access Control)

LAAC is a Next.js web application that enforces division assignment based on user geolocation in Genesys Cloud.

## Overview

This application:
- Enforces SSO-only login for Genesys Cloud
- Determines user country by checking `geolocation.country` via the Genesys Cloud API
- Assigns users to the correct division based on their location
- Redirects to the Genesys Cloud UI after processing

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
cd laac
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
LAAC_COMPLIANT_COUNTRY=Ireland
LAAC_COMPLIANT_DIVISION_ID=your-compliant-division-id
LAAC_NON_COMPLIANT_DIVISION_ID=your-non-compliant-division-id
```

### 5. Local Development

```bash
cd laac
npm run dev
```

Visit `http://localhost:3000` in your browser.

### 6. Testing

```bash
# Run unit tests
cd laac
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

The `vercel.json` file in the `laac` directory is configured for Vercel deployments.

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

## License

[MIT](LICENSE)
