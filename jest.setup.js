// Mock environment variables
process.env.NEXT_PUBLIC_GC_REGION = 'mypurecloud.com';
process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID = 'test-implicit-client-id';
process.env.GC_CC_CLIENT_ID = 'test-cc-client-id';
process.env.GC_CC_CLIENT_SECRET = 'test-cc-client-secret';
process.env.LAAC_COMPLIANT_COUNTRY = 'Ireland';
process.env.LAAC_COMPLIANT_DIVISION_ID = 'compliant-division-id';
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