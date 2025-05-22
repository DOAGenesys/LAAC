import saml, { IdentityProvider, ServiceProvider, Constants } from 'samlify';
import fs from 'fs';
import path from 'path';

// Try to load certificates, but provide defaults if files don't exist
const getCertContent = (filePath: string, defaultContent: string = ''): string => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.warn(`Warning: Could not load certificate from ${filePath}. Using placeholder.`);
    return defaultContent;
  }
};

// Root directory path
const rootDir = process.cwd();

// Path to certificates
const signingKeyPath = path.join(rootDir, 'certs', 'key.pem');
const signingCertPath = path.join(rootDir, 'certs', 'cert.pem');
const genesisCertPath = path.join(rootDir, 'certs', 'genesys-signing.crt');

// Load certificates with fallbacks
const signingKey = getCertContent(
  signingKeyPath, 
  '-----BEGIN PRIVATE KEY-----\nPLACEHOLDER_PRIVATE_KEY\n-----END PRIVATE KEY-----'
);

const signingCert = getCertContent(
  signingCertPath,
  '-----BEGIN CERTIFICATE-----\nPLACEHOLDER_CERTIFICATE\n-----END CERTIFICATE-----'
);

const genesisCert = getCertContent(
  genesisCertPath,
  '-----BEGIN CERTIFICATE-----\nPLACEHOLDER_GENESYS_CERTIFICATE\n-----END CERTIFICATE-----'
);

// Environment variables with defaults for development
const idpEntityID = process.env.IDP_ENTITY_ID || 'https://idp.example.com/metadata';
const baseUrl = process.env.BASE_URL || 'https://idp.example.com';
const genesysSpEntityID = process.env.GENESYS_SP_ENTITY_ID || 'urn:gc:my-org-prod';
const genesysAcs = process.env.GENESYS_ACS || 'https://login.mypurecloud.com/saml';
const genesysSlo = process.env.GENESYS_SLO || 'https://login.mypurecloud.com/saml/logout';
const genesysOrgShort = process.env.GENESYS_ORG_SHORT || 'myorg';

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

// Initialize samlify with custom options if needed
saml.setSchemaValidator({
  validate: (response) => {
    // For development, we'll accept all responses
    // In production, you should use proper schema validation
    return Promise.resolve('Schema validation skipped for development');
  }
}); 