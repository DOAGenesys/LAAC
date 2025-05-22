# SAML Certificates

This directory stores SAML certificates for development and production use.

> **IMPORTANT SECURITY NOTE**: For this demo repository, certificate files ARE committed to Git. 
> This is NOT recommended for production environments. This is a security risk that is only 
> acceptable because this is a private repository used for demonstration purposes only.

## Certificate Files Approach

The application now prioritizes reading certificates from files in this directory:

- `key.pem`: Your IdP's private key
- `cert.pem`: Your IdP's public certificate
- `genesys-signing.pem`: Genesys Cloud's public certificate

If these files are present, they will be used for SAML operations. If not, the application falls back to environment variables.

## Environment Variable Approach (Alternative)

As an alternative, certificates can be stored in environment variables:

- `SAML_SIGNING_KEY`: Your IdP's private key
- `SAML_SIGNING_CERT`: Your IdP's public certificate
- `SAML_GENESYS_CERT`: Genesys Cloud's public certificate

## Certificate Generation

To generate new certificates for testing:

```bash
# Generate a private key and certificate
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 1095 -out cert.pem -subj "/CN=your-domain.com"
```

## Security Notes

- ~~**NEVER commit actual certificate files to version control**~~ **Demo Exception**: Certificate files ARE committed to this repository for demo purposes
- ~~All certificate files in this directory are ignored by `.gitignore`~~ Certificate files are no longer ignored to simplify the demo
- When using environment variables, make sure to properly escape newlines with \n
- For production, consider using certificates signed by a trusted Certificate Authority (CA)
- Self-signed certificates are generally acceptable for SAML IdP signing as the trust is established by uploading the public cert to the SP 