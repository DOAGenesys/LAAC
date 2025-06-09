// Mock environment variables
process.env.NEXT_PUBLIC_GC_REGION = 'mypurecloud.com';
process.env.GC_CC_CLIENT_ID = 'test-cc-client-id';
process.env.GC_CC_CLIENT_SECRET = 'test-cc-client-secret';

process.env.NEXT_PUBLIC_LAAC_DEFAULT_COMPLIANT_COUNTRY = 'Ireland';
process.env.LAAC_COMPLIANT_COUNTRIES = 'Ireland,Spain';
process.env.LAAC_ALTERNATIVE_COUNTRIES = 'Germany,France';
process.env.LAAC_NON_COMPLIANT_DIVISION_ID = 'non-compliant-division-id';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    hash: '',
    host: 'localhost:3000',
    hostname: 'localhost',
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    port: '3000',
    protocol: 'http:',
    search: '',
    toString: () => 'http://localhost:3000',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  },
  writable: true,
});

// Set up environment variables for testing
process.env.IDP_ENTITY_ID = 'https://idp.example.com/metadata';
process.env.BASE_URL = 'https://idp.example.com';
process.env.GENESYS_SP_ENTITY_ID = 'urn:gc:test-org';
process.env.GENESYS_ACS = 'https://login.mypurecloud.com/saml';
process.env.GENESYS_SLO = 'https://login.mypurecloud.com/saml/logout';
process.env.GENESYS_ORG_SHORT = 'testorg';
process.env.JWT_SECRET = 'test-jwt-secret';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    query: {},
  }),
}));

// Mock samlify
jest.mock('samlify', () => {
  return {
    __esModule: true,
    default: {
      IdentityProvider: jest.fn().mockReturnValue({
        getMetadata: jest.fn().mockReturnValue('<EntityDescriptor><IDPSSODescriptor><SingleSignOnService></SingleSignOnService><X509Certificate></X509Certificate></IDPSSODescriptor></EntityDescriptor>'),
        createLoginResponse: jest.fn().mockResolvedValue('mockSAMLResponse'),
        createLogoutResponse: jest.fn().mockResolvedValue('mockLogoutResponse'),
      }),
      ServiceProvider: jest.fn().mockReturnValue({
        entityMeta: {
          getAssertionConsumerService: jest.fn().mockReturnValue([{ Location: 'https://login.mypurecloud.com/saml' }]),
        },
      }),
      setSchemaValidator: jest.fn(),
      BindingNamespace: {
        redirect: {
          extract: jest.fn().mockReturnValue({
            extract: {
              RelayState: 'mockRelayState',
              SAMLRequest: 'mockSAMLRequest',
            },
          }),
        },
      },
      Constants: {
        namespace: {
          binding: {
            redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          },
        },
      },
    },
  };
});

// Mock cookie
jest.mock('cookie', () => ({
  parse: jest.fn().mockImplementation((cookieString) => {
    if (!cookieString) return {};
    // Basic implementation for testing
    return cookieString.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
  }),
  serialize: jest.fn().mockImplementation((name, value, options) => {
    return `${name}=${value}`;
  }),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-token'),
  verify: jest.fn().mockImplementation((token, secret) => {
    if (token === 'valid-token') {
      return { email: 'admin@example.com' };
    }
    throw new Error('Invalid token');
  }),
})); 
