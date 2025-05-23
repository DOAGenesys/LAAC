#!/usr/bin/env node
/**
 * Compare All SAML Environment Variables with Certificate Files
 * 
 * This script compares your SAML environment variables with certificate files
 * and shows detailed analysis for each pair
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Complete SAML Certificate Analysis Tool');
console.log('==========================================');

// Your environment variables
const envVars = {
  SAML_SIGNING_KEY: `-----BEGIN CERTIFICATE-----\n<toBeSupplied,one-liner,use "\n" for line breaks>\n-----END CERTIFICATE-----\n`,
  SAML_GENESYS_CERT: `-----BEGIN CERTIFICATE-----
<toBeSupplied,multiple lines,do not use "\n" for line breaks, but actual line breaks>
-----END CERTIFICATE-----`,
  
  SAML_SIGNING_CERT: `-----BEGIN CERTIFICATE-----\n<toBeSupplied,one-liner,use "\n" for line breaks>\n-----END CERTIFICATE-----\n`
};

// File mappings
const fileMappings = [
  { envKey: 'SAML_SIGNING_CERT', filename: 'cert.pem', type: 'certificate' },
  { envKey: 'SAML_GENESYS_CERT', filename: 'genesys.cer', type: 'certificate' },
  { envKey: 'SAML_SIGNING_KEY', filename: 'key.pem', type: 'private_key' }
];

function processCertificate(content, source, type) {
  // Convert \n to actual newlines and clean up
  const cleanContent = content
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (type === 'certificate') {
    // Extract certificate content (remove BEGIN/END lines)
    const certLines = cleanContent
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\s/g, '');
    
    const certDer = Buffer.from(certLines, 'base64');
    
    // Calculate fingerprints
    const sha1Fingerprint = crypto.createHash('sha1').update(certDer).digest('hex');
    const sha256Fingerprint = crypto.createHash('sha256').update(certDer).digest('hex');
    
    // Format fingerprints with colons
    const formatFingerprint = (fp) => fp.match(/.{2}/g).join(':').toUpperCase();
    
    return {
      source,
      type,
      cleanContent,
      content: certLines,
      sha1: formatFingerprint(sha1Fingerprint),
      sha256: formatFingerprint(sha256Fingerprint),
      derLength: certDer.length,
      pemLength: cleanContent.length
    };
  } else if (type === 'private_key') {
    // For private keys, we can't fingerprint the same way, but we can compare content
    const keyLines = cleanContent
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    
    return {
      source,
      type,
      cleanContent,
      content: keyLines,
      sha1: 'N/A (Private Key)',
      sha256: 'N/A (Private Key)',
      derLength: Buffer.from(keyLines, 'base64').length,
      pemLength: cleanContent.length
    };
  }
}

function compareItems(env, file) {
  const contentMatch = env.content === file.content;
  const lengthMatch = env.pemLength === file.pemLength;
  
  return {
    contentMatch,
    lengthMatch,
    sha1Match: env.type === 'certificate' ? env.sha1 === file.sha1 : 'N/A',
    sha256Match: env.type === 'certificate' ? env.sha256 === file.sha256 : 'N/A'
  };
}

try {
  console.log('📋 Processing all environment variables and files...\n');

  const results = [];

  for (const mapping of fileMappings) {
    const envContent = envVars[mapping.envKey];
    const filePath = path.join(__dirname, '..', 'certs', mapping.filename);
    
    console.log(`🔍 Processing ${mapping.envKey} vs ${mapping.filename}...`);
    
    // Process environment variable
    const envData = processCertificate(envContent, `Environment (${mapping.envKey})`, mapping.type);
    
    // Try to read file
    let fileData = null;
    let fileError = null;
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      fileData = processCertificate(fileContent, `File (${mapping.filename})`, mapping.type);
    } catch (error) {
      fileError = error.message;
    }
    
    results.push({
      mapping,
      envData,
      fileData,
      fileError,
      comparison: fileData ? compareItems(envData, fileData) : null
    });
  }

  console.log('✅ All processing complete\n');

  // Display detailed results
  console.log('🔍 DETAILED ANALYSIS');
  console.log('====================');

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.mapping.envKey} vs ${result.mapping.filename}`);
    console.log('═'.repeat(60));
    
    // Environment data
    console.log(`\n📊 ENVIRONMENT VARIABLE (${result.mapping.envKey}):`);
    console.log('─'.repeat(50));
    console.log('Type:       ', result.envData.type.toUpperCase());
    console.log('SHA1:       ', result.envData.sha1);
    console.log('SHA256:     ', result.envData.sha256);
    console.log('DER Length: ', result.envData.derLength, 'bytes');
    console.log('PEM Length: ', result.envData.pemLength, 'characters');
    
    if (result.fileError) {
      console.log(`\n❌ FILE ERROR (${result.mapping.filename}):`);
      console.log('─'.repeat(50));
      console.log('Error: ', result.fileError);
    } else {
      // File data
      console.log(`\n📊 FILE (${result.mapping.filename}):`);
      console.log('─'.repeat(50));
      console.log('Type:       ', result.fileData.type.toUpperCase());
      console.log('SHA1:       ', result.fileData.sha1);
      console.log('SHA256:     ', result.fileData.sha256);
      console.log('DER Length: ', result.fileData.derLength, 'bytes');
      console.log('PEM Length: ', result.fileData.pemLength, 'characters');
      
      // Comparison
      console.log('\n🔄 COMPARISON RESULTS:');
      console.log('─'.repeat(50));
      console.log('Content Match: ', result.comparison.contentMatch ? '✅ YES' : '❌ NO');
      console.log('Length Match:  ', result.comparison.lengthMatch ? '✅ YES' : '❌ NO');
      if (result.envData.type === 'certificate') {
        console.log('SHA1 Match:    ', result.comparison.sha1Match ? '✅ YES' : '❌ NO');
        console.log('SHA256 Match:  ', result.comparison.sha256Match ? '✅ YES' : '❌ NO');
      }
      
      if (result.comparison.contentMatch) {
        console.log('\n🎉 PERFECT MATCH!');
        console.log('   Environment variable and file are identical.');
      } else {
        console.log('\n⚠️  MISMATCH DETECTED!');
        console.log('   Environment variable and file are different.');
      }
    }
  });

  // Summary
  console.log('\n\n📋 SUMMARY FOR GENESYS CLOUD');
  console.log('=============================');

  const signingCertResult = results.find(r => r.mapping.envKey === 'SAML_SIGNING_CERT');
  if (signingCertResult && signingCertResult.envData) {
    console.log('\n🎯 CERTIFICATE TO UPLOAD TO GENESYS CLOUD:');
    console.log('──────────────────────────────────────────');
    console.log('Use SAML_SIGNING_CERT (NOT SAML_GENESYS_CERT)');
    console.log('Expected SHA1:   ', signingCertResult.envData.sha1);
    console.log('Expected SHA256: ', signingCertResult.envData.sha256);
    console.log('\nSteps to verify:');
    console.log('1. Go to Genesys Cloud Admin > Integrations > Single Sign-on');
    console.log('2. Click Generic SSO Provider tab');
    console.log('3. Check "The Provider\'s Certificate" fingerprint matches above');
    console.log('4. If not, upload this certificate:');
    console.log('\n' + '='.repeat(50));
    console.log(signingCertResult.envData.cleanContent);
    console.log('='.repeat(50));
  }

  // File sync status
  console.log('\n🔄 FILE SYNCHRONIZATION STATUS:');
  console.log('────────────────────────────────');
  const allMatched = results.every(r => r.comparison && r.comparison.contentMatch);
  if (allMatched) {
    console.log('✅ All environment variables match their corresponding files');
    console.log('   Your setup is perfectly synchronized!');
  } else {
    console.log('⚠️  Some environment variables don\'t match their files:');
    results.forEach(r => {
      if (r.comparison && !r.comparison.contentMatch) {
        console.log(`   - ${r.mapping.envKey} ≠ ${r.mapping.filename}`);
      } else if (r.fileError) {
        console.log(`   - ${r.mapping.filename}: File not readable`);
      }
    });
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
} 