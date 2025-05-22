import * as saml from 'samlify';
import { Constants } from 'samlify';
import * as fs from 'fs';
import * as path from 'path';

const readFileIfExists = (filePath: string): string | null => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.log(`[saml/config] File not found or cannot be read: ${filePath}`);
    return null;
  }
};

const getEnvVar = (key: string, defaultValue: string = ''): string => {
  const value = process.env[key];
  if (!value) {
    console.warn(`[saml/config] Warning: Environment variable ${key} is not set. Using default value.`);
    return defaultValue;
  }
  
  // Log a snippet of the value for debugging
  const snippet = value.length > 30 
    ? `${value.substring(0, 15)}...${value.substring(value.length - 15)}`
    : value;
  console.log(`[saml/config] Loaded ${key}: ${snippet} (length: ${value.length})`);
  
  return value;
};

// Function to properly format certificate strings
// Replaces literal "\n" sequences with actual newlines
const formatCertificate = (cert: string): string => {
  // Handle both encoded \n and actual newlines
  if (cert.includes('\\n')) {
    console.log('[saml/config] Converting \\n to actual newlines in certificate');
    return cert.replace(/\\n/g, '\n');
  }
  return cert;
};

console.log('[saml/config] Loading certificates from files or environment variables');

const certsDir = path.join(process.cwd(), 'certs');
const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');
const genesysCertPath = path.join(certsDir, 'genesys-signing.pem');

let signingKey: string;
let signingCert: string;
let genesisCert: string;

const fileSigningKey = readFileIfExists(keyPath);
if (fileSigningKey) {
  console.log(`[saml/config] Loaded signing key from file: ${keyPath} (length: ${fileSigningKey.length})`);
  signingKey = fileSigningKey;
} else {
  const rawSigningKey = getEnvVar(
    'SAML_SIGNING_KEY',
    '-----BEGIN PRIVATE KEY-----\nPLACEHOLDER_PRIVATE_KEY\n-----END PRIVATE KEY-----'
  );
  signingKey = formatCertificate(rawSigningKey);
}

const fileSigningCert = readFileIfExists(certPath);
if (fileSigningCert) {
  console.log(`[saml/config] Loaded signing certificate from file: ${certPath} (length: ${fileSigningCert.length})`);
  signingCert = fileSigningCert;
} else {
  const rawSigningCert = getEnvVar(
    'SAML_SIGNING_CERT',
    '-----BEGIN CERTIFICATE-----\nPLACEHOLDER_CERTIFICATE\n-----END CERTIFICATE-----'
  );
  signingCert = formatCertificate(rawSigningCert);
}

const fileGenesisCert = readFileIfExists(genesysCertPath);
if (fileGenesisCert) {
  console.log(`[saml/config] Loaded Genesys certificate from file: ${genesysCertPath} (length: ${fileGenesisCert.length})`);
  genesisCert = fileGenesisCert;
} else {
  const rawGenesisCert = getEnvVar(
    'SAML_GENESYS_CERT',
    '-----BEGIN CERTIFICATE-----\nPLACEHOLDER_GENESYS_CERTIFICATE\n-----END CERTIFICATE-----'
  );
  genesisCert = formatCertificate(rawGenesisCert);
}

// Check if certificates are in the expected format
const checkCertFormat = (name: string, cert: string): void => {
  if (!cert.includes('\n')) {
    console.warn(`[saml/config] Warning: ${name} does not contain actual newlines. This may cause SAML library errors.`);
  }
  
  const beginMarker = name.includes('KEY') ? '-----BEGIN PRIVATE KEY-----' : '-----BEGIN CERTIFICATE-----';
  const endMarker = name.includes('KEY') ? '-----END PRIVATE KEY-----' : '-----END CERTIFICATE-----';
  
  if (!cert.includes(beginMarker) || !cert.includes(endMarker)) {
    console.warn(`[saml/config] Warning: ${name} is missing proper BEGIN/END markers.`);
  }
  
  console.log(`[saml/config] Certificate format check for ${name}: Includes newlines: ${cert.includes('\n')}, Has begin/end markers: ${cert.includes(beginMarker) && cert.includes(endMarker)}`);
}

checkCertFormat('SAML_SIGNING_KEY', signingKey);
checkCertFormat('SAML_SIGNING_CERT', signingCert);
checkCertFormat('SAML_GENESYS_CERT', genesisCert);

// Environment variables with defaults for development
const idpEntityID = process.env.IDP_ENTITY_ID || 'https://idp.example.com/metadata';
const baseUrl = process.env.BASE_URL || 'https://idp.example.com';
const genesysSpEntityID = process.env.GENESYS_SP_ENTITY_ID || 'urn:gc:my-org-prod';
const genesysAcs = process.env.GENESYS_ACS || 'https://login.mypurecloud.com/saml';
const genesysSlo = process.env.GENESYS_SLO || 'https://login.mypurecloud.com/saml/logout';
const genesysOrgShort = process.env.GENESYS_ORG_SHORT || 'myorg';

console.log(`[saml/config] Configuring IdP with entityID: ${idpEntityID}`);
console.log(`[saml/config] Base URL: ${baseUrl}`);

// Configure the Identity Provider (IdP) - Our Next.js application
export const idp = saml.IdentityProvider({
  entityID: idpEntityID,
  signingCert: signingCert,
  privateKey: signingKey,
  wantAuthnRequestsSigned: false, // Genesys sends unsigned requests by default
  singleSignOnService: [{
    Binding: Constants.namespace.binding.redirect, // HTTP-Redirect binding
    Location: `${baseUrl}/api/saml/sso`,
  }],
  singleLogoutService: [{
    Binding: Constants.namespace.binding.redirect, // HTTP-Redirect binding
    Location: `${baseUrl}/api/saml/logout`,
  }],
});

console.log(`[saml/config] Configuring SP with entityID: ${genesysSpEntityID}`);

// Configure the Service Provider (SP) - Genesys Cloud
export const sp = saml.ServiceProvider({
  entityID: genesysSpEntityID,
  assertionConsumerService: [{
    Binding: Constants.namespace.binding.post, // HTTP-POST binding
    Location: genesysAcs,
  }],
  singleLogoutService: [{
    Binding: Constants.namespace.binding.redirect, // HTTP-Redirect binding
    Location: genesysSlo,
  }],
  wantAssertionsSigned: true,
  wantMessageSigned: false,
  wantLogoutRequestSigned: false,
  isAssertionEncrypted: false, // Genesys docs: no encryption
  signingCert: genesisCert, // Use signingCert property instead of cert
});

// Export other useful constants
export const constants = {
  genesysOrgShort,
  baseUrl,
};

console.log('[saml/config] SAML configuration complete');

// Initialize samlify with custom options if needed
saml.setSchemaValidator({
  validate: (response) => {
    // For development, we'll accept all responses
    // In production, you should use proper schema validation
    return Promise.resolve('Schema validation skipped for development');
  }
}); 