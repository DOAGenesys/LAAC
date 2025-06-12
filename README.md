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
- If user has no valid auth token → Redirected to login page with country selector
- If user has valid auth token and completed LAAC → Proceeds to complete SSO  
- If user has valid auth token but LAAC not completed → Redirected to LAAC process

### **Step 2: Identity Provider Authentication & Country Selection**
LAAC acts as the Identity Provider for Genesys Cloud:
- **Country Selection**: User selects compliant country from comprehensive dropdown (defaults to `NEXT_PUBLIC_LAAC_DEFAULT_COMPLIANT_COUNTRY`)
- **Authentication**: User authenticates with LAAC's internal identity system
- **Flow State Creation**: Selected country and authentication state are stored in secure flow state
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

### **Step 5: LAAC Part 3 - Division Assignment Calculation & User Review**
Applies location-based division assignment logic with user transparency and control:
- **Decision Matrix** (driven by environment variables `NEXT_PUBLIC_LAAC_DEFAULT_COMPLIANT_COUNTRY`, `NEXT_PUBLIC_LAAC_DEFAULT_COUNTRY_FULL_PERMISSIONS`, `LAAC_NON_COMPLIANT_DIVISION_ID`).  No country names are hard-coded; the list of *supported* countries is discovered dynamically from Genesys Cloud divisions named `<Country> - LAAC`.

  | Detected country vs Compliant country | Detected = Compliant? | Detected country is *full-permissions* country? | Primary division | Role division access |
  |--------------------------------------|-----------------------|-----------------------------------------------|------------------|----------------------|
  | Same country & **is** full-perm       | ✓ | ✓ | Division for that country | **All** divisions for every supported country |
  | Same country & **not** full-perm      | ✓ | ✗ | Division for that country | Division for that country only |
  | Different country, compliant **is** full-perm & detected is supported | ✗ | compliant = full-perm | Division for detected country | Division for detected country only |
  | Any other mismatch                    | ✗ | ✗ | `LAAC_NON_COMPLIANT_DIVISION_ID` | `LAAC_NON_COMPLIANT_DIVISION_ID` only |

- **Primary vs Role Divisions**: LAAC sets both the user's primary division *and* the set of divisions attached to the user's roles according to the matrix.
- **Results Display**: System presents comprehensive calculation results showing:
  - Detected Country (from geolocation)
  - Selected Compliant Country (from login form)
  - Compliance Status (Compliant/Non-Compliant)
  - Target Division Assignment(s)
- **User Confirmation**: User must review results and click "Proceed" to continue.
- **API Calls** (executed only after confirmation):
  1. **User Division Assignment** – updates the primary division via Genesys Cloud API.
  2. **Role Division Assignment** – grants divisions to all of the user's roles.
  3. **Role Assignment Retrieval** – fetches current role-division grants.
  4. **Role Assignment Cleanup** – removes old grants so the user ends with exactly the new set.
- **Validation**: Updates are skipped if the user already has the correct primary division and role grants.

#### Testing and Geolocation Override
For testing purposes, the LAAC calculation results page provides an option to manually override the detected geolocation country. After the initial calculations are displayed, a dropdown menu allows developers or testers to select any country from the list, simulating a different location.

When a new country is selected from this dropdown:
- The compliance status is instantly recalculated based on the new "detected" country versus the user's originally selected compliant country.
- The target division assignment is updated in real-time on the UI.
- Clicking "Proceed" will use this overridden country as the `detectedCountry` for the division switch logic, allowing for comprehensive testing of both compliant and non-compliant user flows without needing to be physically in different locations.

### **Step 6: Division Assignment & SAML SSO Completion**
**Technical Process**: LAAC generates and sends a signed SAML Response to Genesys Cloud:
- **SAML Response Generation**: Creates SAML Response containing digitally signed SAML Assertion with user identity
- **Digital Signature**: Uses xml-crypto library to sign the SAML Assertion with RSA-SHA256 and proper XML canonicalization
- **Certificate Inclusion**: Embeds X.509 certificate in signature's KeyInfo element for Genesys Cloud verification
- **Assertion Consumer Service (ACS)**: POSTs SAML Response to Genesys Cloud's ACS URL (`https://login.{region}.{domain}/saml`)
- **SAML Attributes**: Includes required attributes (`email`, `OrganizationName`, `ServiceName`)
- **Signature Validation**: Genesys Cloud verifies the digital signature to ensure assertion integrity and authenticity
- **Authentication Signal**: This is when Genesys Cloud is notified of successful authentication
- **Final Redirect**: User is logged into Genesys Cloud with correct division assignment

## SAML Single Logout (SLO) Process

LAAC implements comprehensive SAML Single Logout to ensure proper session termination across both systems:

### **Logout Flow Types**

#### **SP-Initiated Logout (User logs out from Genesys Cloud)**
1. **Logout Request**: Genesys Cloud sends SAML LogoutRequest to LAAC's SLO endpoint
2. **Request Parsing**: LAAC extracts session information (NameID, SessionIndex, Issuer)
3. **Session Termination**: LAAC clears internal authentication cookies and session data
4. **Logout Response**: LAAC generates SAML LogoutResponse with matching session context
5. **Response Validation**: Genesys Cloud validates the response matches the request
6. **Final Redirect**: User is redirected to Genesys Cloud login page

#### **IdP-Initiated Logout (User logs out from LAAC)**
1. **Logout Trigger**: User clicks logout button in LAAC application
2. **Session Cleanup**: LAAC clears authentication cookies and client-side session storage
3. **Direct Redirect**: LAAC redirects directly to Genesys Cloud logout URL
4. **Session Termination**: Genesys Cloud terminates the user's session
5. **Final Redirect**: User is redirected to Genesys Cloud login page

### **Logout Implementation Details**

#### **Session Context Preservation**
- **NameID Extraction**: Properly extracts user identifier from SAML logout request
- **SessionIndex Handling**: Captures and echoes back session identifiers
- **Issuer Validation**: Verifies logout request comes from trusted Genesys Cloud entity

#### **SAML Logout Request Processing**
```xml
<!-- Incoming Logout Request from Genesys Cloud -->
<samlp:LogoutRequest 
    ID="_unique-request-id" 
    Destination="https://laac.vercel.app/api/saml/logout">
  <saml:Issuer>urn:gc:your-org</saml:Issuer>
  <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
    user@example.com
  </saml:NameID>
  <samlp:SessionIndex>session-id-from-login</samlp:SessionIndex>
</samlp:LogoutRequest>
```

#### **SAML Logout Response Generation**
```xml
<!-- Outgoing Logout Response to Genesys Cloud -->
<samlp:LogoutResponse 
    InResponseTo="_unique-request-id"
    Destination="https://login.mypurecloud.ie/saml/logout">
  <saml:Issuer>https://laac.vercel.app/api/saml/metadata</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
</samlp:LogoutResponse>
```

#### **Error Handling and Fallbacks**
- **Graceful Degradation**: If SAML parsing fails, redirects to safe logout URL
- **Session Mismatch Protection**: Validates session context before responding
- **Comprehensive Logging**: Detailed logs for debugging logout flow issues

## User Interface & Experience

### **Enhanced Login Interface**
- **Country Selector**: Comprehensive dropdown with all 195 countries, alphabetically sorted
- **Default Selection**: Pre-populated with `NEXT_PUBLIC_LAAC_DEFAULT_COMPLIANT_COUNTRY` environment variable
- **Required Field**: Users must select a country before proceeding with authentication
- **Professional Styling**: Consistent with existing form design and accessibility standards

### **Transparent LAAC Process**
- **Real-time Progress**: Visual progress bar with step-by-step status updates
- **Calculation Results Display**: Clear presentation of all decision factors:
  - Detected geographic location vs. user-selected compliant country
  - Compliance determination logic and result
  - Target division assignment with clear labeling
- **User Control**: "Proceed" button requirement ensures users review and confirm results
- **Error Handling**: Comprehensive error messages with actionable guidance

### **Data Flow Transparency**
- **Login Page**: Country selection with immediate visual feedback
- **Processing Page**: Step-by-step progress with intermediate results
- **Results Page**: Complete calculation breakdown before final action
- **Completion**: Clear success indication and automatic redirect

## Technical Architecture

### **SSO Integration (SAML 2.0 IdP)**
- **Identity Provider**: LAAC acts as SAML 2.0 IdP for Genesys Cloud (Service Provider)
- **Flow Support**: Supports both IdP-initiated and SP-initiated SAML flows
- **Certificate-Based**: Uses X.509 certificates for SAML assertion signing
- **Metadata Endpoint**: Publishes IdP metadata at `/api/saml/metadata`

### **SAML Digital Signature Implementation**
LAAC implements industry-standard XML Digital Signature specification for SAML compliance:

#### **Signature Library and Standards**
- **xml-crypto Library**: Uses the professional-grade `xml-crypto` library instead of custom implementations
- **SAML 2.0 Compliance**: Follows OASIS SAML 2.0 specification for digital signatures
- **XML-DSIG Standard**: Implements W3C XML Digital Signature standard requirements

#### **Cryptographic Algorithms**
- **Signature Algorithm**: RSA-SHA256 (`http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`)
- **Canonicalization**: Exclusive Canonicalization (`http://www.w3.org/2001/10/xml-exc-c14n#`)
- **Digest Algorithm**: SHA256 (`http://www.w3.org/2001/04/xmlenc#sha256`)
- **Transforms**: Enveloped signature and exclusive canonicalization transforms

#### **Signature Structure and Placement**
- **Assertion-Level Signing**: Signature is placed inside the `<saml:Assertion>` element
- **Proper Positioning**: Signature appears immediately after the Assertion's `<saml:Issuer>`
- **XPath Targeting**: Uses precise XPath expressions to target SAML assertions
- **Reference URI**: Properly references the signed Assertion by its `ID` attribute

#### **Certificate Management**
- **X.509 Integration**: Includes X.509 certificate in `<KeyInfo>` element for verification
- **Certificate Chain**: Supports full certificate validation chain
- **Private Key Security**: Private keys remain server-side only, never exposed to client

#### **Technical Implementation Details**
```xml
<saml:Assertion ID="unique-assertion-id">
  <saml:Issuer>https://laac.vercel.app/api/saml/metadata</saml:Issuer>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#unique-assertion-id">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>base64-encoded-digest</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>base64-encoded-signature</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>base64-encoded-certificate</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
  <!-- Rest of assertion content -->
</saml:Assertion>
```

#### **Security and Validation**
- **Signature Verification**: Genesys Cloud validates signatures using the provided X.509 certificate
- **Tamper Detection**: Any modification to signed content invalidates the signature
- **Replay Protection**: Combined with timestamp validation prevents replay attacks
- **Certificate Validation**: Ensures signing certificate is trusted and valid

### **Location Services**
- **Client-Side Geolocation**: HTML5 Geolocation API for coordinate acquisition
- **Backend Geocoding**: Server-side geocoding via `geocode.maps.co` API
- **Privacy Protection**: Coordinates processed client-side, only country determination sent to backend

### **Genesys Cloud Integration**
- **Client Credentials OAuth**: Server-side API access for user search, division management, and role assignment
- **Required Scopes**: `authorization:division:edit`, `users:search`, and `authorization:role:edit` permissions
- **API Endpoints**: 
  - User search (`/api/v2/users/search`)
  - User division assignment (`/api/v2/authorization/divisions/{divisionId}/objects/USER`)
  - Role division assignment (`/api/v2/authorization/roles/{roleId}?subjectType=PC_USER`)
  - Role assignment retrieval (`/api/v2/authorization/subjects/{userId}`)
  - Role assignment cleanup (`/api/v2/authorization/subjects/{userId}/bulkremove`)

#### **Four-Step Division Assignment Process**

When a user requires division reassignment, LAAC executes a comprehensive four-step process to ensure clean role-division management:

**Step 1: User Division Assignment**
```http
POST /api/v2/authorization/divisions/{targetDivisionId}/objects/USER
Body: ["{userId}"]
```
Assigns the user to the target division based on detected location vs selected country comparison.

**Step 2: Current Role Assignment Retrieval**
```http
GET /api/v2/authorization/subjects/{userId}
```
Retrieves all current role assignments to identify all roles the user has.

**Step 3: Dynamic Role Division Assignment Addition**
```http
POST /api/v2/authorization/roles/{roleId}?subjectType=PC_USER
Body: {"subjectIds":["{userId}"],"divisionIds":["{targetDivisionId}"]}
```
For each role identified in Step 2, adds a new role-division grant for the user in the target division. This process happens in parallel for all user roles.

**Step 4: Old Role Assignment Cleanup**
```http
POST /api/v2/authorization/subjects/{userId}/bulkremove
Body: {"grants":[{"roleId":"{roleId}","divisionId":"{oldDivisionId}"},...]}
```
Removes old role-division grants for all user roles from other divisions, leaving only the new assignments in the target division.

This process ensures users have exactly one division assignment for each of their roles, eliminating orphaned permissions and maintaining clean authorization state. The dynamic approach automatically handles users with multiple roles without requiring hardcoded role IDs.

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
5. Add scopes: `authorization:division:edit users:search authorization:role:edit`
6. Save the Client ID and Secret

#### 3.3 Get Division IDs

1. Go to **Admin** ► **Account** ► **Divisions**
2. Note the IDs for:
   - LAAC-compliant division
   - Non-compliant division

Note: Role IDs are no longer required in configuration as LAAC now dynamically detects and manages all user roles automatically.

### 4. Environment Configuration

Create a `.env.local` file with the following variables:

```bash
# Genesys Cloud Region (e.g. mypurecloud.com, mypurecloud.ie, etc.)
NEXT_PUBLIC_GC_REGION=mypurecloud.de

# OAuth Client ID for Client Credentials (back-end)
GC_CC_CLIENT_ID=your-cc-client-id

# OAuth Client Secret for Client Credentials (back-end)
GC_CC_CLIENT_SECRET=your-cc-client-secret

# Location and Division Configuration
NEXT_PUBLIC_LAAC_DEFAULT_COMPLIANT_COUNTRY=Ireland
NEXT_PUBLIC_LAAC_DEFAULT_COUNTRY_FULL_PERMISSIONS=Switzerland
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
- **APIs**: Complete REST API and SAML endpoint documentation below
- **State Management**: React state, `sessionStorage` for flow state tracking
- **Testing**: Jest for unit tests, Cypress for E2E tests
- **Logging**: Custom logger module (`src/lib/logger.ts`) for structured logging and metrics

## API Documentation

### **Internal LAAC API Endpoints**

#### **SAML Identity Provider Endpoints**

##### `GET /api/saml/metadata`
**Purpose**: Provides SAML 2.0 IdP metadata for Genesys Cloud configuration
- **Method**: GET
- **Authentication**: None (public endpoint)
- **Response**: XML metadata document
- **Content-Type**: `application/xml`
- **Usage**: Configure this URL in Genesys Cloud SSO settings

**Example Response**:
```xml
<EntityDescriptor entityID="https://laac.vercel.app/api/saml/metadata">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService 
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
        Location="https://laac.vercel.app/api/saml/sso"/>
    <SingleLogoutService 
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
        Location="https://laac.vercel.app/api/saml/logout"/>
  </IDPSSODescriptor>
</EntityDescriptor>
```

##### `GET/POST /api/saml/sso`
**Purpose**: SAML Single Sign-On endpoint - processes authentication and generates SAML responses
- **Method**: GET (IdP-initiated) or POST (SP-initiated)
- **Authentication**: Cookie-based session authentication
- **Parameters**:
  - `SAMLRequest` (optional): Base64-encoded SAML AuthnRequest from Genesys Cloud
  - `RelayState` (optional): State information to preserve through SSO flow
- **Response**: HTML form with auto-submit to Genesys Cloud ACS
- **Flow**: Validates user authentication → Checks LAAC completion → Generates signed SAML response

**Request Flow**:
1. Validates user authentication cookie
2. Verifies LAAC process completion
3. Generates digitally signed SAML assertion
4. Returns HTML form that auto-submits to Genesys Cloud

##### `GET /api/saml/logout`
**Purpose**: SAML Single Logout endpoint - handles logout requests and responses
- **Method**: GET
- **Authentication**: Optional (works with or without active session)
- **Parameters**:
  - `SAMLRequest` (optional): Base64-encoded SAML LogoutRequest from Genesys Cloud
  - `RelayState` (optional): State information for logout flow
  - `Signature` (optional): Digital signature from Genesys Cloud
  - `SigAlg` (optional): Signature algorithm used
- **Response**: HTTP redirect to appropriate logout destination

**SP-Initiated Logout Flow**:
1. Parses incoming SAML LogoutRequest
2. Extracts NameID, SessionIndex, and Issuer
3. Clears authentication cookies
4. Generates SAML LogoutResponse with matching session context
5. Redirects to Genesys Cloud with LogoutResponse

**IdP-Initiated Logout Flow**:
1. Clears authentication cookies and session storage
2. Redirects directly to Genesys Cloud logout URL

#### **Authentication Endpoints**

##### `POST /api/auth/verify`
**Purpose**: Authenticates users with LAAC's internal identity system
- **Method**: POST
- **Content-Type**: `application/json`
- **Request Body**:
```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```
- **Response**: Sets authentication cookie and returns user information
- **Success**: HTTP 200 with user details
- **Failure**: HTTP 401 with error message

#### **Location and Geocoding Endpoints**

##### `POST /api/geocode`
**Purpose**: Converts geographic coordinates to country information
- **Method**: POST
- **Authentication**: Server-side only (not exposed to frontend)
- **Content-Type**: `application/json`
- **Request Body**:
```json
{
  "latitude": 47.3769,
  "longitude": 8.5417
}
```
- **Response**:
```json
{
  "country": "Switzerland",
  "success": true
}
```
- **External API**: Uses `geocode.maps.co` for geocoding services
- **Error Handling**: Returns error details if geocoding fails

##### `GET /api/countries`
**Purpose**: Provides list of all countries for dropdown selection
- **Method**: GET
- **Authentication**: None
- **Response**:
```json
{
  "countries": ["Afghanistan", "Albania", "Algeria", ...]
}
```

#### **Division Management Endpoints**

##### `POST /api/division-switch`
**Purpose**: Executes complete user and role division assignment workflow
- **Method**: POST
- **Authentication**: Session-based (requires authenticated user)
- **Content-Type**: `application/json`
- **Request Body**:
```json
{
  "targetDivisionId": "division-uuid",
  "userId": "user-uuid",
  "detectedCountry": "Germany",
  "selectedCountry": "Ireland"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Division assignment completed",
  "oldDivision": "old-division-uuid",
  "newDivision": "division-uuid",
  "rolesUpdated": 3
}
```

**Four-Step Process**:
1. Assigns user to target division
2. Retrieves current role assignments
3. Adds role-division grants for target division
4. Removes old role-division grants

##### `POST /api/users/search`
**Purpose**: Searches for users in Genesys Cloud by email
- **Method**: POST
- **Authentication**: Session-based
- **Content-Type**: `application/json`
- **Request Body**:
```json
{
  "email": "user@example.com"
}
```
- **Response**:
```json
{
  "users": [{
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "division": {
      "id": "division-uuid",
      "name": "Division Name"
    }
  }]
}
```

#### **Administrative Endpoints**

##### `GET /api/admin/users`
**Purpose**: Administrative endpoint for user management
- **Method**: GET
- **Authentication**: Admin session required
- **Response**: List of users with administrative information
- **Access Control**: Validates administrative privileges before allowing access

### **Genesys Cloud API Endpoints Used**

LAAC integrates with the following Genesys Cloud Public API endpoints:

#### **OAuth Authentication**

##### `POST https://login.{region}/oauth/token`
**Purpose**: Obtains access tokens for Genesys Cloud API access
- **Method**: POST
- **Authentication**: Client Credentials (Basic Auth)
- **Content-Type**: `application/x-www-form-urlencoded`
- **Request Body**:
```
grant_type=client_credentials
```
- **Response**:
```json
{
  "access_token": "bearer-token",
  "token_type": "bearer",
  "expires_in": 86400
}
```
- **Scopes Required**: `authorization:division:edit users:search authorization:role:edit`

#### **User Management**

##### `POST https://api.{region}/api/v2/users/search`
**Purpose**: Searches for users by email or other criteria
- **Method**: POST
- **Authentication**: Bearer token
- **Content-Type**: `application/json`
- **Request Body**:
```json
{
  "pageSize": 25,
  "pageNumber": 1,
  "query": [{
    "type": "TERM",
    "fields": ["email"],
    "value": "user@example.com"
  }]
}
```
- **Response**:
```json
{
  "results": [{
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "division": {
      "id": "division-uuid",
      "name": "Division Name"
    }
  }],
  "total": 1
}
```

#### **Division Assignment**

##### `POST https://api.{region}/api/v2/authorization/divisions/{divisionId}/objects/USER`
**Purpose**: Assigns users to a specific division
- **Method**: POST
- **Authentication**: Bearer token
- **Content-Type**: `application/json`
- **Path Parameters**:
  - `divisionId`: UUID of target division
- **Request Body**:
```json
["user-uuid-1", "user-uuid-2"]
```
- **Response**: HTTP 204 (No Content) on success
- **Required Permission**: `authorization:division:edit`

#### **Role Management**

##### `GET https://api.{region}/api/v2/authorization/subjects/{userId}`
**Purpose**: Retrieves all role assignments for a specific user
- **Method**: GET
- **Authentication**: Bearer token
- **Path Parameters**:
  - `userId`: UUID of the user
- **Response**:
```json
{
  "grants": [{
    "subjectId": "user-uuid",
    "roleId": "role-uuid",
    "divisionId": "division-uuid"
  }]
}
```

##### `POST https://api.{region}/api/v2/authorization/roles/{roleId}?subjectType=PC_USER`
**Purpose**: Grants role permissions to users in specific divisions
- **Method**: POST
- **Authentication**: Bearer token
- **Content-Type**: `application/json`
- **Path Parameters**:
  - `roleId`: UUID of the role
- **Query Parameters**:
  - `subjectType`: Must be `PC_USER`
- **Request Body**:
```json
{
  "subjectIds": ["user-uuid"],
  "divisionIds": ["division-uuid"]
}
```
- **Response**: HTTP 204 (No Content) on success

##### `POST https://api.{region}/api/v2/authorization/subjects/{userId}/bulkremove`
**Purpose**: Removes multiple role assignments from a user
- **Method**: POST
- **Authentication**: Bearer token
- **Content-Type**: `application/json`
- **Path Parameters**:
  - `userId`: UUID of the user
- **Request Body**:
```json
{
  "grants": [{
    "roleId": "role-uuid",
    "divisionId": "old-division-uuid"
  }]
}
```
- **Response**: HTTP 204 (No Content) on success

#### **API Integration Details**

**Error Handling**:
- All Genesys Cloud APIs return standard HTTP status codes
- 401: Invalid or expired access token
- 403: Insufficient permissions
- 404: Resource not found
- 429: Rate limiting applied

**Rate Limiting**:
- Genesys Cloud APIs implement rate limiting
- LAAC includes retry logic with exponential backoff
- Concurrent requests are managed to stay within limits

**Authentication Flow**:
1. LAAC uses Client Credentials OAuth flow
2. Access tokens are cached and refreshed automatically
3. All API calls include proper Authorization headers
4. Tokens are scoped to minimum required permissions

**Security Headers**:
- LAAC filters out infrastructure headers before making API calls
- Only explicitly defined headers are sent to Genesys Cloud
- Prevents accidental forwarding of platform-specific metadata

## Security Considerations

- No sensitive credentials in the client bundle (only `NEXT_PUBLIC_*` vars)
- Geocoding API key is server-side only, not exposed to the frontend
- Server-side OAuth token has minimal required scopes (`authorization:division:edit users:search authorization:role:edit`)
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

## Troubleshooting

### SAML Signature Issues

If you encounter SAML signature verification errors from Genesys Cloud:

#### **Common Error Messages**
- `"crypto/rsa: verification error"` - Invalid signature format or algorithm
- `"Oh no! Something went wrong!"` - Generic Genesys Cloud error page
- `"XPath parse error"` - Incorrect XPath expression in signature targeting

#### **Debugging Steps**

1. **Check Certificate Configuration**
   ```bash
   # Verify certificate format in environment variables
   # Ensure proper PEM format with actual newlines (not \n strings)
   ```

2. **Validate Signature Structure**
   - Signature should be inside `<saml:Assertion>` element, not at Response level
   - Reference URI must match the Assertion ID attribute
   - Proper namespace declarations required

3. **Algorithm Verification**
   ```xml
   <!-- Ensure these exact algorithms are used -->
   <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
   <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
   <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
   ```

4. **Log Analysis**
   - Enable `LOG_LEVEL=DEBUG` in environment variables
   - Check for `[xmlSigner]` log entries showing signature computation
   - Verify signed XML structure in logs

#### **Recent Signature Implementation Improvements**
- **Migration from Custom Implementation**: Replaced custom XML signing with industry-standard `xml-crypto` library
- **Proper XPath Targeting**: Fixed XPath expressions to correctly target SAML assertions
- **Correct Signature Placement**: Moved signature from Response level to inside Assertion element
- **SAML-Compliant Algorithms**: Implemented proper RSA-SHA256 with exclusive canonicalization
- **Certificate Integration**: Added X.509 certificate to KeyInfo element for verification

#### **Key Files**
- `src/lib/saml/xmlSigner.ts` - Main signature implementation
- `src/pages/api/saml/sso.ts` - SAML Response generation and signing
- `src/lib/saml/config.ts` - Certificate and algorithm configuration

### Certificate Management

#### **Certificate Format Requirements**
```bash
# Private Key (SAML_SIGNING_KEY)
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhki...
-----END PRIVATE KEY-----

# Certificate (SAML_SIGNING_CERT)
-----BEGIN CERTIFICATE-----
MIIDpzCCAo+gAwIB...
-----END CERTIFICATE-----
```

#### **Environment Variable Configuration**
- Certificates must include actual newlines, not `\n` escape sequences
- Application automatically converts `\n` strings to actual newlines during configuration
- Ensure no extra spaces or characters in certificate content

## Observability

### **Structured Logging**

LAAC implements comprehensive structured logging for debugging, monitoring, and analytics:

#### **Logger Implementation**
The application uses a custom logger (`src/lib/logger.ts`) that provides:
- **Structured Logging**: JSON-formatted log entries with consistent fields
- **Log Levels**: Support for DEBUG, INFO, WARN, ERROR levels
- **Component Tagging**: Each log entry includes component/module identification
- **Production-Safe**: Automatic masking of sensitive data in production environments

#### **Log Categories**

**SAML Operations**
```javascript
[saml/config] Loading certificates from environment variables
[saml/config] SAML configuration complete
[api/saml/sso] SSO handler started
[xmlSigner] Using xml-crypto library for SAML-compliant XML signature
[xmlSigner] Signature computed successfully
```

**Location Services**
```javascript
[geolocation] Browser geolocation request initiated
[geocode] Converting coordinates to country: lat=47.3769, lng=8.5417
[geocode] Geocoding result: Switzerland
```

**Genesys Cloud Integration**
```javascript
[genesys] OAuth token request successful
[genesys] User search initiated for: user@example.com
[genesys] Division assignment: user moved to compliant division
```

**Security Events**
```javascript
[auth] User authentication successful
[flow] Flow state validation passed
[security] Sensitive data masked in logs
```

#### **Debug Mode**

Enable detailed logging by setting environment variable:
```bash
LOG_LEVEL=DEBUG
```

Debug mode provides:
- **Full SAML XML Content**: Complete SAML Response and Assertion XML
- **Certificate Details**: Private keys and certificates (with masking for sensitive parts)
- **API Request/Response Details**: Full HTTP headers and payloads
- **Flow State Tracking**: Step-by-step validation of LAAC process
- **Signature Analysis**: Detailed XML signature computation logs

#### **Log Analysis and Monitoring**

**Key Log Patterns to Monitor:**
- `[xmlSigner] ERROR:` - SAML signature failures
- `[auth] Authentication failed:` - User authentication issues  
- `[genesys] API error:` - Genesys Cloud integration problems
- `[flow] Flow state invalid:` - Security bypass attempts
- `[geocode] Geocoding failed:` - Location service failures

**Performance Metrics:**
- Response generation time for SAML assertions
- Genesys Cloud API response times
- Geocoding service latency
- Overall SSO completion time

#### **Security and Privacy**

**Data Masking:**
- Authentication tokens automatically masked in logs
- Private keys show only type and length, not content
- Personal information (emails, names) can be masked in production
- API responses sanitized to remove sensitive Genesys Cloud data

**Log Security:**
```javascript
// Example of masked sensitive data
[api/saml/sso] Auth token preview: eyJhbGciOiJIUzI1NiIs***MASKED***
[xmlSigner] Private key length: 1704 (content masked)
[genesys] User email: u***@example.com
```


