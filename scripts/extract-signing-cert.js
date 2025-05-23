#!/usr/bin/env node
/**
 * Extract SAML Signing Certificate for Genesys Cloud Upload
 * 
 * This script extracts the SAML_SIGNING_CERT from your environment
 * and formats it properly for upload to Genesys Cloud.
 */

const fs = require('fs');
const path = require('path');

console.log('🔐 SAML Signing Certificate for Genesys Cloud Upload');
console.log('====================================================');

// Try to read .env.local file
let signingCert = null;
const envPath = path.join(__dirname, '..', '.env.local');

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('SAML_SIGNING_CERT=')) {
      signingCert = line.split('=', 2)[1];
      // Remove quotes if present
      if (signingCert.startsWith('"') && signingCert.endsWith('"')) {
        signingCert = signingCert.slice(1, -1);
      }
      break;
    }
  }
} catch (error) {
  console.error('❌ Could not read .env.local file');
  console.error('Please copy your SAML_SIGNING_CERT manually from your .env.local file');
  process.exit(1);
}

if (!signingCert) {
  console.error('❌ SAML_SIGNING_CERT not found in .env.local file');
  console.error('Please check your .env.local file contains SAML_SIGNING_CERT=...');
  process.exit(1);
}

console.log('✅ Certificate found');
console.log('');
console.log('📋 Copy this certificate and upload it to Genesys Cloud:');
console.log('   Admin > Integrations > Single Sign-on > Generic SSO Provider');
console.log('   Section: "The Provider\'s Certificate"');
console.log('   Click "Select Certificates to upload" and paste this certificate');
console.log('');
console.log('Certificate to upload:');
console.log('======================');

// Convert \n to actual newlines if needed
const formattedCert = signingCert.replace(/\\n/g, '\n');
console.log(formattedCert);

console.log('======================');
console.log('');
console.log('⚠️  IMPORTANT: This is your SIGNING certificate that signs SAML responses');
console.log('   Do NOT use the SAML_GENESYS_CERT - that\'s a different certificate');
console.log('');
console.log('🔄 After uploading, test SSO again'); 