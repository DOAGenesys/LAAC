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
- **Country Selection**: User selects compliant country from comprehensive dropdown (defaults to `NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY`)
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
- **Calculation Logic**: Based on user-selected compliant country (not detected location)
  - **Compliant Users**: Selected country matches `NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY` → Assigned to `LAAC_COMPLIANT_DIVISION_ID`
  - **Non-Compliant Users**: Selected country differs from `NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY` → Assigned to `LAAC_NON_COMPLIANT_DIVISION_ID`
- **Results Display**: System presents comprehensive calculation results showing:
  - Detected Country (from geolocation)
  - Selected Compliant Country (from login form)
  - Compliance Status (Compliant/Non-Compliant)
  - Target Division Assignment
- **User Confirmation**: User must review results and click "Proceed" button to continue
- **API Call**: Only after user confirmation, updates user division assignment via Genesys Cloud API
- **Validation**: Only updates if user is not already in correct division

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

## User Interface & Experience

### **Enhanced Login Interface**
- **Country Selector**: Comprehensive dropdown with all 195 countries, alphabetically sorted
- **Default Selection**: Pre-populated with `NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY` environment variable
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

Create a `.env.local` file with the following variables:

```bash
# Genesys Cloud Region (e.g. mypurecloud.com, mypurecloud.ie, etc.)
NEXT_PUBLIC_GC_REGION=mypurecloud.de

# OAuth Client ID for Client Credentials (back-end)
GC_CC_CLIENT_ID=your-cc-client-id

# OAuth Client Secret for Client Credentials (back-end)
GC_CC_CLIENT_SECRET=your-cc-client-secret

# Location and Division Configuration
NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY=Switzerland
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

#### **Integration with External Systems**

**Vercel Logs:**
- Automatic integration with Vercel's logging system
- Real-time log streaming in Vercel dashboard
- Log retention according to Vercel plan limits

**External Log Aggregation:**
The structured JSON format is compatible with:
- **Splunk**: For enterprise log analysis
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **DataDog**: Application performance monitoring
- **CloudWatch**: AWS log aggregation
- **Google Cloud Logging**: GCP log management

#### **Log Format Example**

```json
{
  "timestamp": "2025-06-05T12:04:34.343Z",
  "level": "INFO",
  "component": "api/saml/sso",
  "message": "SAML response created successfully",
  "metadata": {
    "userId": "user123",
    "orgId": "testdrivetest",
    "responseId": "_4cbd587ea3f8970cb842",
    "duration": "245ms"
  }
}
```

#### **Troubleshooting with Logs**

**Common Debug Scenarios:**
1. **SAML Issues**: Search for `[xmlSigner]` and `[saml/config]` entries
2. **Authentication Problems**: Filter by `[auth]` component
3. **Location Failures**: Look for `[geolocation]` and `[geocode]` logs
4. **API Integration**: Monitor `[genesys]` component logs
5. **Security Events**: Check `[flow]` and `[security]` entries

**Log Analysis Tips:**
- Use timestamp correlation to trace request flows
- Filter by component tags for focused debugging  
- Monitor error patterns for systemic issues
- Track performance metrics over time
