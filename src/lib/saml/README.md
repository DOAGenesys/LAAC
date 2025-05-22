# SAML Identity Provider for Genesys Cloud

This module implements a SAML 2.0 Identity Provider (IdP) that Genesys Cloud can use as a Generic SSO provider.

## Overview

The SAML IdP implementation provides:

1. **Metadata Endpoint** (`/api/saml/metadata`) - Publishes the IdP configuration
2. **Single Sign-On** (`/api/saml/sso`) - Handles SAML authentication requests
3. **Single Logout** (`/api/saml/logout`) - Handles SAML logout requests
4. **Login UI** (`/login`) - Simple login interface for users

## Configuration

The IdP requires the following environment variables:

```
# Base URL of your application
BASE_URL=https://idp.example.com

# Entity ID for the IdP (typically the metadata URL)
IDP_ENTITY_ID=https://idp.example.com/metadata

# Genesys Cloud Service Provider Entity ID (from Genesys Cloud UI)
GENESYS_SP_ENTITY_ID=urn:gc:my-org-prod

# Genesys Cloud Assertion Consumer Service URL (region-specific)
GENESYS_ACS=https://login.mypurecloud.com/saml

# Genesys Cloud Single Logout URL (region-specific)
GENESYS_SLO=https://login.mypurecloud.com/saml/logout

# Genesys Cloud Organization Short Name (for SAML attribute)
GENESYS_ORG_SHORT=myorg
```

## Certificates

This IdP requires X.509 certificates for signing SAML assertions:

- `/certs/key.pem` - Private key
- `/certs/cert.pem` - Public certificate
- `/certs/genesys-signing.crt` - Genesys Cloud's public certificate

See the README in the `/certs` directory for instructions on generating these files.

## Genesys Cloud Configuration

To configure Genesys Cloud to use this IdP:

1. Go to **Admin > Single Sign-on > Generic SSO Provider**
2. Configure these settings:
   - **Provider Name**: "LAAC Identity Provider"
   - **Provider Certificate**: Upload `cert.pem`
   - **Issuer URI**: Your `IDP_ENTITY_ID` value
   - **Target URL**: Your SSO endpoint (`BASE_URL` + `/api/saml/sso`)
   - **Single Logout URI**: Your logout endpoint (`BASE_URL` + `/api/saml/logout`)
   - **Single Logout Binding**: HTTP Redirect
   - **Name Identifier Format**: EmailAddress
3. Map these attributes:
   - `email` → email
   - `OrganizationName` → Your organization short name
   - `ServiceName` → `directory` (redirects to Collaborate client)

## Security Considerations

1. **Clock Synchronization**: Ensure server time is synchronized (< 10s skew)
2. **TLS Required**: HTTPS is mandatory for all endpoints
3. **Certificate Management**: Keep private keys secure and monitor certificate expiration
4. **User Matching**: Email addresses must match exactly between IdP and Genesys Cloud

## Limitations

This implementation is intended for demonstration purposes and has some limitations:

1. Uses static user credentials for demo purposes (real implementations should use a proper database)
2. Minimal error handling and user experience
3. No multi-factor authentication support
4. Limited session management

## References

- [Genesys Cloud SSO Documentation](https://all.docs.genesys.com/AUI/Current/AUHelp/SSO)
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf) 