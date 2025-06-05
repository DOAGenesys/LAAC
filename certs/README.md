# SAML Certificates

This directory is for temporary storage of SAML certificates during development only.

## Environment Variable Approach

As of the latest update, all certificates are now stored in environment variables instead of files:

- `SAML_SIGNING_KEY`: Your IdP's private key
- `SAML_SIGNING_CERT`: Your IdP's public certificate
- `SAML_GENESYS_CERT`: Genesys Cloud's public certificate

## Certificate Generation

To generate new SAML certificates, run these exact commands:

```bash
# Navigate to the certs directory
cd certs

# Generate private key and certificate (valid for 5 years)
openssl req -newkey rsa:2048 -nodes -keyout saml-signing-key.pem -x509 -days 1825 -out saml-signing-cert.pem -subj "/CN=your-domain.com"

# Display the private key content (copy this to SAML_SIGNING_KEY environment variable)
type saml-signing-key.pem

# Display the certificate content (copy this to SAML_SIGNING_CERT environment variable)
type saml-signing-cert.pem

# Clean up the private key file (KEEP the certificate file for Genesys Cloud upload)
del saml-signing-key.pem

# NOTE: Keep saml-signing-cert.pem - you'll need to upload this file to Genesys Cloud UI (Generic SSO config)
```

## Security Notes

- **NEVER commit actual certificate files to version control**
- All certificate files in this directory are ignored by `.gitignore`
- After adding certificate contents to environment variables, delete the private key file immediately but keep the certificate file for Genesys Cloud upload
- Replace "your-domain.com" with your actual domain when generating certificates 
