const fs = require('fs');
const path = require('path');

console.log('Testing certificate loading logic');

const certsDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');
const genesysCertPath = path.join(certsDir, 'genesys-signing.pem');

const readFileIfExists = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`✅ Successfully loaded file: ${path.basename(filePath)} (length: ${content.length})`);
    return content;
  } catch (error) {
    console.log(`❌ Could not read file: ${path.basename(filePath)}`);
    console.log(`   Error: ${error.message}`);
    return null;
  }
};

console.log('\n=== Testing File-Based Certificate Loading ===\n');
readFileIfExists(keyPath);
readFileIfExists(certPath);
readFileIfExists(genesysCertPath);

console.log('\n=== Testing Environment Variable Certificate Loading ===\n');
const envVars = ['SAML_SIGNING_KEY', 'SAML_SIGNING_CERT', 'SAML_GENESYS_CERT'];
for (const envVar of envVars) {
  const value = process.env[envVar];
  if (value) {
    const snippet = value.length > 30 
      ? `${value.substring(0, 15)}...${value.substring(value.length - 15)}`
      : value;
    console.log(`✅ Found environment variable ${envVar}: ${snippet} (length: ${value.length})`);
  } else {
    console.log(`❌ Environment variable ${envVar} not set`);
  }
}

console.log('\n=== Analysis ===\n');
const keyExists = fs.existsSync(keyPath);
const certExists = fs.existsSync(certPath);
const genesysCertExists = fs.existsSync(genesysCertPath);
const hasKeyEnv = !!process.env.SAML_SIGNING_KEY;
const hasCertEnv = !!process.env.SAML_SIGNING_CERT;
const hasGenesysCertEnv = !!process.env.SAML_GENESYS_CERT;

console.log('Based on the testing results:');
console.log(`- Signing Key: Will use ${keyExists ? 'FILE' : hasKeyEnv ? 'ENVIRONMENT VARIABLE' : 'DEFAULT PLACEHOLDER'}`);
console.log(`- Signing Certificate: Will use ${certExists ? 'FILE' : hasCertEnv ? 'ENVIRONMENT VARIABLE' : 'DEFAULT PLACEHOLDER'}`);
console.log(`- Genesys Certificate: Will use ${genesysCertExists ? 'FILE' : hasGenesysCertEnv ? 'ENVIRONMENT VARIABLE' : 'DEFAULT PLACEHOLDER'}`);

console.log('\nTest complete!'); 