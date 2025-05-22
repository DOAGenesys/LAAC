import * as saml from 'samlify';
import { Constants } from 'samlify';

// Function to safely get environment variables with fallbacks
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  const value = process.env[key];
  if (!value) {
    console.warn(`Warning: Environment variable ${key} is not set. Using default value.`);
    return defaultValue;
  }
  return value;
};

// Get certificates from environment variables with fallbacks
const signingKey = getEnvVar(
  'SAML_SIGNING_KEY',
  '-----BEGIN PRIVATE KEY-----\nPLACEHOLDER_PRIVATE_KEY\n-----END PRIVATE KEY-----'
);

const signingCert = getEnvVar(
  'SAML_SIGNING_CERT',
  '-----BEGIN CERTIFICATE-----\nPLACEHOLDER_CERTIFICATE\n-----END CERTIFICATE-----'
);

const genesisCert = getEnvVar(
  'SAML_GENESYS_CERT',
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