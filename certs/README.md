# SAML Certificates

This directory is for temporary storage of SAML certificates during development only.

## Environment Variable Approach

As of the latest update, all certificates are now stored in environment variables instead of files:

- `SAML_SIGNING_KEY`: Your IdP's private key
- `SAML_SIGNING_CERT`: Your IdP's public certificate
- `SAML_GENESYS_CERT`: Genesys Cloud's public certificate

## Certificate Generation

To generate new certificates for testing:

```bash
# Generate a private key and certificate
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 1095 -out cert.pem -subj "/CN=your-domain.com"
```

After generating, read these files and add their contents to the environment variables.

## Security Notes

- **NEVER commit actual certificate files to version control**
- All certificate files in this directory are ignored by `.gitignore`
- After adding certificate contents to environment variables, delete the local certificate files 