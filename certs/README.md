# Certificate Requirements

This directory should contain the following files:
- `key.pem` - Private key for the IdP (Identity Provider)
- `cert.pem` - Public certificate for the IdP
- `genesys-signing.crt` - Genesys Cloud's public certificate (download from the Genesys Cloud UI)

## Generation Instructions

Before using the SAML IdP in production, you must generate proper X.509 certificates.

### Using OpenSSL (Recommended)

```bash
# Install OpenSSL if not already available
# For Windows: Download from https://slproweb.com/products/Win32OpenSSL.html

# Generate a 2048-bit RSA key pair and self-signed certificate (valid for 3 years)
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 1095 -out cert.pem -subj "/CN=idp.example.com"
```

### Important Security Notes

1. The private key (`key.pem`) should be kept secure and should not be shared or checked into version control.
2. In production, consider using a certificate signed by a trusted Certificate Authority.
3. Certificates have an expiration date. The sample certificate is valid for 3 years, but you may need to renew it earlier.
4. The certificate fingerprint must be registered with Genesys Cloud.

## Genesys Cloud Certificate

To download the Genesys Cloud certificate:
1. Go to Admin > Single Sign-on > Generic SSO Provider in the Genesys Cloud UI
2. Under "Genesys Cloud Signing Certificate", click "Download Certificate"
3. Save the file as `genesys-signing.crt` in this directory 