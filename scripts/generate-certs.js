const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure certs directory exists
const certsDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

try {
  console.log('Generating self-signed certificate...');
  
  // Create a configuration file for OpenSSL
  const configPath = path.join(certsDir, 'openssl.cnf');
  const opensslConfig = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
CN=idp.example.com
O=LAAC Identity Provider
OU=SSO Service
C=US
  `;
  
  fs.writeFileSync(configPath, opensslConfig);
  
  // Generate private key and certificate
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');
  
  // Execute OpenSSL command to generate a self-signed certificate
  const opensslCommand = `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 1095 -config "${configPath}"`;
  
  try {
    execSync(opensslCommand);
    console.log('Certificate and private key generated successfully!');
    console.log(`Private key: ${keyPath}`);
    console.log(`Certificate: ${certPath}`);
    
    // Clean up config file
    fs.unlinkSync(configPath);
  } catch (error) {
    console.error('Error executing OpenSSL command:', error.message);
    console.log('OpenSSL may not be installed or not in PATH.');
    console.log('Alternative: you need to manually generate certificate files:');
    console.log('1. Install OpenSSL');
    console.log('2. Run: openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem -out certs/cert.pem -days 1095 -subj "/CN=idp.example.com"');
  }
} catch (error) {
  console.error('Error:', error.message);
} 