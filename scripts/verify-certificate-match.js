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
  SAML_SIGNING_KEY: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDO8hDWePuCN4gq\nP9F0ew1cX/65zxt9pc8HLPxkhIoQ8skLyHiv9zivNwGsoVch6fMtiRq92jIrDrKW\nwq3RVbJVQyx15QmF+EbV3R30sZTEKpAPrmf4agBCzmHQ0kvVncnEgZl7uIU8wjXj\nyNmKl5VEzjHx2ry93FKjZkkpmWP+RZtbM78VHS70tCVwmVPCtTy7uj8gkDYj4LVL\nCFXW4b+n3zpqvSIsp2b5IjWxXDSF4mNX+OfmhK8/1U7Ly9wUUGGZMkW2VyjHpGz6\nSd5CWyhg1UnXnQmK6Lad9WTpnPjA4Z73R1FxPLBN6PDG+7Fs5rHviz6PxLLKaL1s\nltxKsvCdAgMBAAECggEAAcpYWPKtAmBmni71KfPSlsUB2CuxijHAC8jY2inHZAQl\ntyNh3+vcoq9wJUU0EsgKYY95GsFjg7nZ07IVfOUn6NLu9Iopve369ui11KMgrV3M\n50XUAnMwU2OjtwHKxCtcToXshQSAqpjnjHP1ZdyP3wuFpRkGXwIj+OPuqBx6n/2I\nMfK8ReWUYEGsErnq9humHwvmB2vcHDvdSMxUdUuvvpfIPmimbhcyn4V9a24Nmwit\nGpUur5z1yDjR+Eco3rsyvBwlZz2ZiAmmuxBa4p1sCAUHGWcpYnLaJY/aE38jzaoI\nzXqwf7fXNCzo3rAiMYS5jNbI5dvtNrS6pO//Zu0gxQKBgQDn8Xipj+1GY0Is6R9B\n8gKyWia0pA6hLQ7nuQ4OaiSajX02zMvCpV6C3wE/Mn4raP7RL+MUkHuWHXe9npHu\nwK8tiVpkbX7fiED8xikfbf7HagVVMSbEosJgh5WfIHKGzd+84VxxZ4nMH1VUoSsD\njQP7djj69rxaX+1+S5H95F9tBwKBgQDkaNvxkP4e0nB3rA1mO+DxAk0SsdVSGZiu\nHh3U6b0gdkA5teuTkWLBdqKR2PQknXBgX/Eh/UAAq80AM30iM4reluUxeg6RprMB\ntwYhRRjQSPVgXTOLEK2EZ6UD73IZF6bryWRWmR9JT3wcjhwiESLLcJd2U5S6jqCQ\nGQ2+1ECwOwKBgQDipvrMZ5LsF47RKDWdUYsFEkeEelS5d7h7BEESIPMH/H+Bj3sG\nCGdk59rmEMduUDnB3VPAArhiJwWdzFi6wJvumaw1OzKh6RnoaRRCXFB+OcJgT5mc\nyZe8kIHLb/+6b2/VuTuGrjDfwTa3bo8D90cO8aYYyAejIN6JbfuJ6SK+/QKBgQCY\noYGoUS2fRxyku7JQiN7t7o22WmOkczpV0AY7St55HMwaRHjhqZuGkFJeh83N0e9Q\nV4x5HBRy3lslMUMDYdIAoHETuO6XYf/ou3c7MEM+nCJsfJt+6GwrOF9K2+0w219N\n3MxSGgyQHq9fHY+rLCxGKjzscznF2J1u7W8EAC4iFQKBgD6o7aB+OBK3RdKcp+Ct\nAYn+XefFm+NqFMJSz7OJIy5Jw9BPcbmKtVWj3HrQfBGXsNo4grsMS+8goA6kKoj8\n3GB+3Moq/gUo4H54Dum3wTObjhQWZCgfU58lXIIagi1jLu7CLHbJNahVTtT8ptk0\nJKbotTDLuLNgLTixlgX60CsL\n-----END PRIVATE KEY-----\n`,
  
  SAML_GENESYS_CERT: `-----BEGIN CERTIFICATE-----
MIIF1jCCA76gAwIBAgIUaOaWUAViTAKnIJ9h/tDRtyRrARAwDQYJKoZIhvcNAQEL
BQAwgYwxCzAJBgNVBAYTAlVTMRAwDgYDVQQIDAdJbmRpYW5hMRQwEgYDVQQHDAtJ
bmRpYW5hcG9pczEQMA4GA1UECgwHR2VuZXN5czEWMBQGA1UECwwNR2VuZXN5cyBD
bG91ZDErMCkGA1UEAwwiR2VuZXN5cyBDbG91ZCBBdXRob3JpemF0aW9uIFNlcnZl
cjAeFw0yMzA5MDYxNTMyMzJaFw0yNjAxMDExNTMyMzJaMIGMMQswCQYDVQQGEwJV
UzEQMA4GA1UECAwHSW5kaWFuYTEUMBIGA1UEBwwLSW5kaWFuYXBvaXMxEDAOBgNV
BAoMB0dlbmVzeXMxFjAUBgNVBAsMDUdlbmVzeXMgQ2xvdWQxKzApBgNVBAMMIkdl
bmVzeXMgQ2xvdWQgQXV0aG9yaXphdGlvbiBTZXJ2ZXIwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQCii2n7AX3+Szv40q9VcvN6/Nyu+fdd5UPOYT135wYN
ibphALO0RekV1PTpOH/NmXLP3dh6xHsfxXv5ttP0ItEuwSSLZ7WAI0L2TYdfxSKC
tczisJ1fWcPtr3vNOjjeoJaZFMbHUw5Qsd/MQZrvCjEv181UhRnkfJV/q0TpDhQH
YC7BMgP+8sFmVCXVMtPr8nYbvM8PRdLAHZuGagQdLq6l01IgWdxgrnfyqStVVByJ
cMZ4c9Vqb+n5oMQs4XGeRjmOyNQ1Y+FwUB9tf4u0NNvxrMHz1f53gPOtLNvIXkyC
PXGUUIc+Z3+8Vzfxjc2GQHoaT0fz4WTyv9L8Vbej9kYXi1m9qJQVYZOUjRHsPdEj
FC3PFQnVsM9Ex14KIBEZuLvCOTCi7P+EliPyErw+c7BGWcrikoEiTobicmqLWy9Q
K5psn/zHX+fDHQOPitFWD+VVkd+n/ao7SQc4m3iuR1m0CsxqYolYlv8okA74rKAA
3WYspkyFXpCpuOqXnvcmOoyxp63PWcCC9RLc8XUcpda1qiyxQ4iI0pZAS01LNZwG
UN37DBvV+6Z148Hq77oLrQBIli0WRkd6rUO23q5rnZyZrC/BYmntD04R2ng+GppV
EfM9m1FZzzRoEREFotxYCoWaiu5rzOwI+T6X8p/Cn5ertmQsY8xmaBgB4seAkPJO
vQIDAQABoy4wLDALBgNVHQ8EBAMCB4AwHQYDVR0OBBYEFD+Bm9uwpB4y6WnN5Z6F
FFOEkqaaMA0GCSqGSIb3DQEBCwUAA4ICAQCaOP3BHizj0Gu8TMAIa9J0/EDng4JI
6EqxrJa1fXPRrRwXrgzwZHr/AzCTPR/oz4PEop7AP/ZL0qJUkNu8I9Wv1hSqz1H8
Y9a3qEmP0BShg4maZWz/1rdjuMLmqKSk34sSJkcRxxf4yNoDCKsmpZ2KYxn7rPr7
TRdZRAIot5t+4vJxrhU4pMOt3MME/UonErrsSOE0ERDzpCCq+5ZJDuAn1U2CsemB
L8gGVKbU1jMsl46m2TnRkm6IUF3sxpaGFiDooYrtkSjHAvfKvDTQZaFvKkvO4zFu
gh4O/8SBuZPEjIZMffdeJSQer9c8vSaR7EmheGtj5KbQ98EjtKBYax9pTc36nOzn
9unbW1T5pPSDJeK8crdAqVCLxy86LuAuD/GeiCQXfj09Jjk+yeVwX6Frym0lh4DE
E/16fsYHG6b3aKfDZqPbSpdmltHCcr9dsfi2rtvYyoahF0/Mnz1iFDI+NUzd4tm2
TJhPVyPqFFDl0vNG8ftfwtuwwLNEF/cD+f33pOrZA5Pc6SokNnXRGxMUda6xtgrn
CDyno1bffprXq355uu8489PsG2pvhn+Q7aqPuQ96biPQNotP3FbvevBeRZQGwfTo
FW3NoHiXdW3IoeOKDCE4LmtLHoNWMePxgpcxbOot7h8JbAMOFi2vVxv28f221+fi
0ZNL7WezrxTWhg==
-----END CERTIFICATE-----`,
  
  SAML_SIGNING_CERT: `-----BEGIN CERTIFICATE-----\nMIIDFTCCAf2gAwIBAgIUZ6r+DG8wAk6RkxYDIhGo68ufr3UwDQYJKoZIhvcNAQEL\nBQAwGjEYMBYGA1UEAwwPbGFhYy52ZXJjZWwuYXBwMB4XDTI1MDUyMjA4NTAzMFoX\nDTI4MDUyMTA4NTAzMFowGjEYMBYGA1UEAwwPbGFhYy52ZXJjZWwuYXBwMIIBIjAN\nBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzvIQ1nj7gjeIKj/RdHsNXF/+uc8b\nfaXPByz8ZISKEPLJC8h4r/c4rzcBrKFXIenzLYkavdoyKw6ylsKt0VWyVUMsdeUJ\nhfhG1d0d9LGUxCqQD65n+GoAQs5h0NJL1Z3JxIGZe7iFPMI148jZipeVRM4x8dq8\nvdxSo2ZJKZlj/kWbWzO/FR0u9LQlcJlTwrU8u7o/IJA2I+C1SwhV1uG/p986ar0i\nLKdm+SI1sVw0heJjV/jn5oSvP9VOy8vcFFBhmTJFtlcox6Rs+kneQlsoYNVJ150J\niui2nfVk6Zz4wOGe90dRcTywTejwxvuxbOax74s+j8Syymi9bJbcSrLwnQIDAQAB\no1MwUTAdBgNVHQ4EFgQUa1IkekSlhARWGwBsySZ9JXnem6UwHwYDVR0jBBgwFoAU\na1IkekSlhARWGwBsySZ9JXnem6UwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0B\nAQsFAAOCAQEALX4lKSml5HM5iZs9qC7or8iLOaUCbysld3JPVbZTkz7irRZWUZS6\nH264ryGljZLx6BM7jht3bUz10iXQxdLF6nASdlfkxfy4+kwxq7D2tPFPbnO6e2Zs\nHIR/l2qFXJmAEdXFrr+jhC6sihnwobKJoTTVkmYupixEvYBv6ZtRFoTxvW83Mjzq\nUOGpt+4949bhjtO+U2R9KKMcgClwJuVyxbMBq4NnQ1IP2wj0IbzhEtZeRHUslbzk\npScQSKz1NdYigUMgaQn5ILFvwjSrbUl2tbU0MV40Iez/tL/OM9JW1Z9Kji22Arxr\nUfAebXbPV7BhkjiN2/CfIKmfx/9kvOC0FQ==\n-----END CERTIFICATE-----\n`
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