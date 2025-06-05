import * as saml from 'samlify';
import { Constants } from 'samlify';
import { logger } from './logger';

// Function to safely get environment variables with fallbacks
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  const value = process.env[key];
  if (!value) {
    logger.warn('saml/config', `Environment variable ${key} is not set. Using default value.`);
    return defaultValue;
  }
  
  // Log a snippet of the value for debugging
  const snippet = value.length > 30 
    ? `${value.substring(0, 15)}...${value.substring(value.length - 15)}`
    : value;
  logger.info('saml/config', `Loaded ${key}: ${snippet} (length: ${value.length})`);
  
  return value;
};

// Function to process certificate strings and handle escape sequences
const processCertificate = (cert: string): string => {
  if (cert.includes('\\n')) {
    logger.info('saml/config', 'Converting \\n to actual newlines in certificate');
    return cert.replace(/\\n/g, '\n');
  }
  return cert;
};

// Function to validate certificate format
const validateCertificate = (name: string, cert: string): void => {
  const hasNewlines = cert.includes('\n');
  const hasMarkers = cert.includes('BEGIN') && cert.includes('END');
  logger.info('saml/config', `Certificate format check for ${name}: Includes newlines: ${hasNewlines}, Has begin/end markers: ${hasMarkers}`);
};

// Get certificates from environment variables with fallbacks
logger.info('saml/config', 'Loading certificates from environment variables');
const rawSigningKey = getEnvVar(
  'SAML_SIGNING_KEY',
  '-----BEGIN PRIVATE KEY-----\nPLACEHOLDER_PRIVATE_KEY\n-----END PRIVATE KEY-----'
);

const rawSigningCert = getEnvVar(
  'SAML_SIGNING_CERT',
  '-----BEGIN CERTIFICATE-----\nPLACEHOLDER_CERTIFICATE\n-----END CERTIFICATE-----'
);

const rawGenesisCert = getEnvVar(
  'SAML_GENESYS_CERT',
  '-----BEGIN CERTIFICATE-----\nPLACEHOLDER_GENESYS_CERTIFICATE\n-----END CERTIFICATE-----'
);

// Format certificates (replace \n with actual newlines)
const signingKey = processCertificate(rawSigningKey);
const signingCert = processCertificate(rawSigningCert);
const genesisCert = processCertificate(rawGenesisCert);

// Check if certificates are in the expected format
validateCertificate('SAML_SIGNING_KEY', signingKey);
validateCertificate('SAML_SIGNING_CERT', signingCert);
validateCertificate('SAML_GENESYS_CERT', genesisCert);

// Environment variables with defaults for development
const idpEntityID = process.env.IDP_ENTITY_ID || 'https://idp.example.com/metadata';
const baseUrl = process.env.BASE_URL || 'https://idp.example.com';
const genesysSpEntityID = process.env.GENESYS_SP_ENTITY_ID || 'urn:gc:my-org-prod';
const genesysAcs = process.env.GENESYS_ACS || 'https://login.mypurecloud.com/saml';
const genesysSlo = process.env.GENESYS_SLO || 'https://login.mypurecloud.com/saml/logout';
const genesysOrgShort = process.env.GENESYS_ORG_SHORT || 'myorg';

logger.info('saml/config', `Configuring IdP with entityID: ${idpEntityID}`);
logger.info('saml/config', `Base URL: ${baseUrl}`);

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

logger.info('saml/config', `Configuring SP with entityID: ${genesysSpEntityID}`);

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

logger.info('saml/config', 'SAML configuration complete');

// Initialize samlify with custom options if needed
saml.setSchemaValidator({
  validate: (response) => {
    // For development, we'll accept all responses
    // In production, you should use proper schema validation
    return Promise.resolve('Schema validation skipped for development');
  }
}); 