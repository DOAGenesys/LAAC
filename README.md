# LAAC (Location-Aware Access Control)

LAAC is a Next.js web application that acts as a SAML Identity Provider (IdP) for Genesys Cloud while enforcing location-based division assignment through an integrated LAAC process.

## Overview

This application combines two main functions:
1. **SSO Identity Provider**: Acts as a SAML 2.0 IdP for Genesys Cloud authentication
2. **Location-Aware Access Control**: Enforces division assignment based on user geolocation before completing SSO

## Core Workflow

LAAC implements a secure 6-step authentication and location control workflow:

### **Step 1: SSO Entry Point**
User accesses the LAAC application (`https://laac.vercel.app`). The system checks for existing authentication state:
- If user has no valid auth token → Redirected to login page
- If user has valid auth token and completed LAAC → Proceeds to complete SSO  
- If user has valid auth token but LAAC not completed → Redirected to LAAC process

### **Step 2: Identity Provider Authentication**
LAAC acts as the Identity Provider for Genesys Cloud:
- User authenticates with LAAC's internal identity system
- **CRITICAL**: LAAC does NOT signal successful authentication to Genesys Cloud yet
- Authentication success only enables access to the LAAC process
- This prevents users from bypassing LAAC by accessing Genesys Cloud directly

### **Step 3: LAAC Part 1 - Geolocation Detection**
Location compliance verification using browser-based geolocation:
- **HTML5 Geolocation**: Uses `navigator.geolocation.getCurrentPosition()` to get coordinates
- **Geocoding**: Converts coordinates to country using backend API call to `geocode.maps.co`
- **Permission Handling**: Users who deny location permissions are automatically flagged as non-compliant
- **Deprecated Approach**: Previous Genesys Cloud SDK geolocation code is commented in codebase as a valid example of Genesys Cloud JavaScript SDK usage in TypeScript

### **Step 4: LAAC Part 2 - User Profile Resolution**
Backend user search using Genesys Cloud Client Credentials OAuth:
- **API Endpoint**: `POST /api/v2/users/search`
- **Search Method**: Searches by partial email (before @ symbol)
- **User Data**: Retrieves `userId` and current `divisionId` from search results
- **Authentication**: Uses server-side client credentials (not user's session)

**API Call Example:**
```json
POST /api/v2/users/search
{
  "pageSize": 25,
  "pageNumber": 1,
  "query": [{
    "type": "TERM",
    "fields": ["email"], 
    "value": "user.email"
  }]
}
```

### **Step 5: LAAC Part 3 - Division Assignment**
Applies location-based division assignment logic:
- **Compliant Users**: Users in configured compliant country → Assigned to `LAAC_COMPLIANT_DIVISION_ID`
- **Non-Compliant Users**: Users in other countries or who denied location → Assigned to `LAAC_NON_COMPLIANT_DIVISION_ID`
- **API Call**: Updates user division assignment via Genesys Cloud API
- **Validation**: Only updates if user is not already in correct division

### **Step 6: SAML SSO Completion**
**Technical Process**: LAAC generates and sends a signed SAML Response to Genesys Cloud:
- **SAML Response Generation**: Creates signed SAML Response containing SAML Assertion with user identity
- **Assertion Consumer Service (ACS)**: POSTs SAML Response to Genesys Cloud's ACS URL (`https://login.{region}.{domain}/saml`)
- **SAML Attributes**: Includes required attributes (`email`, `OrganizationName`, `ServiceName`)
- **Authentication Signal**: This is when Genesys Cloud is notified of successful authentication
- **Final Redirect**: User is logged into Genesys Cloud with correct division assignment

## Technical Architecture

### **SSO Integration (SAML 2.0 IdP)**
- **Identity Provider**: LAAC acts as SAML 2.0 IdP for Genesys Cloud (Service Provider)
- **Flow Support**: Supports both IdP-initiated and SP-initiated SAML flows
- **Certificate-Based**: Uses X.509 certificates for SAML assertion signing
- **Metadata Endpoint**: Publishes IdP metadata at `/api/saml/metadata`

### **Location Services**
- **Client-Side Geolocation**: HTML5 Geolocation API for coordinate acquisition
- **Backend Geocoding**: Server-side geocoding via `geocode.maps.co` API
- **Privacy Protection**: Coordinates processed client-side, only country determination sent to backend

### **Genesys Cloud Integration**
- **Client Credentials OAuth**: Server-side API access for user search and division management
- **Minimal Scopes**: `authorization:division:edit` and `users:search` permissions only
- **API Endpoints**: User search, division assignment, organization management

## Flow State Security

LAAC implements comprehensive flow state validation to prevent bypass attacks:
- **Session Flow Tokens**: Unique session IDs prevent unauthorized access to LAAC steps
- **Sequential Validation**: Each step validates completion of previous steps
- **Timeout Protection**: Flow states expire after 15 minutes
- **Bypass Prevention**: Direct access to `/laac` without proper flow state redirects to start

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
NEXT_PUBLIC_GC_REGION=mypurecloud.de

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

LOG_LEVEL=DEBUG
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

## Architecture

- **Frontend**: Next.js/React (Pages Router), TailwindCSS
- **Backend**: Next.js API routes acting as SAML 2.0 Identity Provider
- **Authentication**: SAML 2.0 IdP for Genesys Cloud, Client Credentials OAuth for backend API calls
- **Location Services**: HTML5 Geolocation API, backend geocoding via geocode.maps.co
- **APIs**: 
  - `/api/saml/sso` - SAML SSO endpoint (generates and sends SAML Response to Genesys Cloud)
  - `/api/saml/metadata` - SAML IdP metadata endpoint
  - `/api/division-switch` - Updates user division assignment
  - `/api/users/search` - Finds users by email in Genesys Cloud
  - `/api/geocode` - Converts latitude/longitude to country information (backend only)
- **State Management**: React state, `sessionStorage` for flow state tracking
- **Testing**: Jest for unit tests, Cypress for E2E tests
- **Logging**: Custom logger module (`src/lib/logger.ts`) for structured logging and metrics

## Security Considerations

- No sensitive credentials in the client bundle (only `NEXT_PUBLIC_*` vars)
- Geocoding API key is server-side only, not exposed to the frontend
- Server-side OAuth token has minimal scopes (`authorization:division:edit users:search`)
- SAML signing certificates properly secured with private key server-side only
- Geolocation data processed client-side only, coordinates sent to backend geocoding API
- CORS protection via same-origin API routes
- **Flow State Security**: Comprehensive validation prevents bypass attacks and unauthorized access
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