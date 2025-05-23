# ACME Certificate Setup Guide

This guide explains how to use ACME (Automated Certificate Management Environment) to generate SSL certificates for your `laac.vercel.app` domain using tools like win-acme or certbot.

## Overview

The application now includes an ACME HTTP-01 challenge endpoint that allows certificate authorities like Let's Encrypt to verify domain ownership during certificate generation.

## How It Works

1. When you request a certificate, the ACME CA (like Let's Encrypt) generates a challenge token
2. The CA expects to find a specific response at `http://laac.vercel.app/.well-known/acme-challenge/{token}`
3. Our application serves this response through the API endpoint at `/api/.well-known/acme-challenge/[token].ts`
4. Once verified, the CA issues the certificate

## Setup Methods

### Method 1: Environment Variables (Recommended for Vercel)

For each challenge, set an environment variable with the pattern:
```
ACME_CHALLENGE_{TOKEN} = {RESPONSE}
```

Where `{TOKEN}` is the challenge token with special characters replaced by underscores and converted to uppercase.

Example:
```bash
# If the token is "abc123-def456"
ACME_CHALLENGE_ABC123_DEF456 = "abc123-def456.your-account-thumbprint"
```

#### For Vercel Deployment:
1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to "Environment Variables"
4. Add the challenge environment variable
5. Redeploy if necessary

### Method 2: Temporary Files

The endpoint also supports reading challenge responses from files:

#### Using the temp directory:
```bash
# Create the challenge file
node scripts/acme-helper.js set "abc123-def456" "abc123-def456.your-account-thumbprint"
```

#### Using the public directory (for static hosting):
```bash
# Create the challenge file in public directory
node scripts/acme-helper.js set "abc123-def456" "abc123-def456.your-account-thumbprint" --public
```

## Using win-acme

1. **Install win-acme** on your Windows machine
2. **Run win-acme** with HTTP-01 validation
3. **When prompted for the challenge**, use one of the methods above to set the challenge response
4. **Monitor the logs** to see what token/response is expected

### Example win-acme command:
```cmd
wacs.exe --target manual --host laac.vercel.app --validation http-01-selfhosting
```

## Using certbot

1. **Install certbot** on your system
2. **Use manual mode** for HTTP-01 challenge
3. **Set the challenge response** when prompted

### Example certbot command:
```bash
certbot certonly --manual --preferred-challenges http-01 -d laac.vercel.app
```

## Helper Script Usage

The `scripts/acme-helper.js` script provides convenient utilities:

```bash
# Set a challenge response
node scripts/acme-helper.js set "token123" "token123.response456"

# Set a challenge response in public directory
node scripts/acme-helper.js set "token123" "token123.response456" --public

# List current challenges
node scripts/acme-helper.js list

# Clear a specific challenge
node scripts/acme-helper.js clear "token123"

# Clear all challenges
node scripts/acme-helper.js clear-all
```

## Troubleshooting

### Common Issues:

1. **404 Error**: The challenge endpoint can't find the response
   - Check that the environment variable is set correctly
   - Verify the token format (special characters should be replaced with underscores)
   - Ensure the application is deployed with the new environment variable

2. **403 Error**: The CA can't access the endpoint
   - Verify that `laac.vercel.app` is accessible from the internet
   - Check that there are no firewall or proxy issues

3. **Environment Variable Not Found**:
   - Check the variable name format: `ACME_CHALLENGE_{TOKEN_WITH_UNDERSCORES}`
   - Ensure the variable is set in the correct environment (local vs. Vercel)
   - Redeploy after setting environment variables in Vercel

### Debugging:

Check the application logs to see what the endpoint is looking for:
```
[acme-challenge] No challenge response found for token: abc123-def456
[acme-challenge] Checked environment variable: ACME_CHALLENGE_ABC123_DEF456
[acme-challenge] Checked temp file: /path/temp/.well-known/acme-challenge/abc123-def456
[acme-challenge] Checked public file: /path/public/.well-known/acme-challenge/abc123-def456
```

## Security Considerations

1. **Challenge responses are temporary** and only valid during certificate generation
2. **Challenges are not sensitive data** but should be cleaned up after use
3. **Environment variables** containing challenges should be removed after certificate generation
4. **File-based challenges** are automatically ignored by git via `.gitignore`

## Important Notes for Vercel

- Vercel already provides automatic SSL certificates for custom domains
- Manual certificate generation is typically only needed for special requirements
- Environment variables in Vercel require redeployment to take effect
- Consider using Vercel's built-in SSL management unless you have specific certificate requirements

## Next Steps

After successfully generating your certificate:
1. Clean up any temporary challenge responses
2. Update your application to use the new certificate if needed
3. Set up automatic renewal if required
4. Remove temporary environment variables 