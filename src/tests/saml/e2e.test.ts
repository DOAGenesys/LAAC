import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import metadataHandler from '@/pages/api/saml/metadata';
import ssoHandler from '@/pages/api/saml/sso';
import logoutHandler from '@/pages/api/saml/logout';
import authHandler from '@/pages/api/auth/verify';
import { userService } from '@/lib/saml/userService';
import cookie from 'cookie';

// Mock userService
jest.mock('@/lib/saml/userService', () => ({
  authenticate: jest.fn(),
  verifyToken: jest.fn(),
  findByEmail: jest.fn(),
}));

describe('SAML End-to-End Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Complete SP-initiated authentication flow', async () => {
    // Step 1: Genesys Cloud redirects to SSO endpoint with SAMLRequest
    const { req: ssoReq, res: ssoRes } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        SAMLRequest: 'mockSAMLRequest',
        RelayState: 'mockRelayState',
      },
    });

    // Mock userService to return null (not authenticated)
    (userService.verifyToken as jest.Mock).mockReturnValue(null);

    // Call the SSO handler
    await ssoHandler(ssoReq, ssoRes);

    // Should redirect to login page
    expect(ssoRes.statusCode).toBe(302);
    expect(ssoRes._getRedirectUrl()).toBe('/login?relayState=mockRelayState');

    // Step 2: User submits login form
    const { req: authReq, res: authRes } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'password123',
      },
    });

    // Mock successful authentication
    const mockUser = {
      id: '1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
    };
    (userService.authenticate as jest.Mock).mockReturnValue(mockUser);

    // Call the auth handler
    await authHandler(authReq, authRes);

    // Should return 200 with user info and set auth cookie
    expect(authRes.statusCode).toBe(200);
    const authCookie = authRes.getHeader('Set-Cookie');
    expect(authCookie).toBeDefined();
    
    // Step 3: After login, user is redirected back to SSO endpoint
    const { req: ssoReq2, res: ssoRes2 } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        RelayState: 'mockRelayState',
      },
      headers: {
        cookie: String(authCookie),
      },
    });

    // Mock authenticated user
    (userService.verifyToken as jest.Mock).mockReturnValue(mockUser);

    // Call the SSO handler again
    await ssoHandler(ssoReq2, ssoRes2);

    // Should return HTML form with SAML response
    expect(ssoRes2.statusCode).toBe(200);
    expect(ssoRes2._getHeaders()['content-type']).toBe('text/html');
    const responseBody = ssoRes2._getData();
    expect(responseBody.includes('form id="samlform" method="post"')).toBe(true);
    expect(responseBody.includes('name="SAMLResponse"')).toBe(true);
    expect(responseBody.includes('name="RelayState" value="mockRelayState"')).toBe(true);

    // Step 4: User logs out
    const { req: logoutReq, res: logoutRes } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        SAMLRequest: 'mockLogoutRequest',
      },
      headers: {
        cookie: String(authCookie),
      },
    });

    // Call the logout handler
    await logoutHandler(logoutReq, logoutRes);

    // Should clear auth cookie and return success page
    const logoutCookie = logoutRes.getHeader('Set-Cookie');
    expect(logoutCookie).toBeDefined();
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes._getData().includes('Successfully logged out')).toBe(true);
  });

  test('Complete IdP-initiated authentication flow', async () => {
    // Step 1: User logs in directly to LAAC
    const { req: authReq, res: authRes } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'password123',
      },
    });

    // Mock successful authentication
    const mockUser = {
      id: '1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
    };
    (userService.authenticate as jest.Mock).mockReturnValue(mockUser);

    // Call the auth handler
    await authHandler(authReq, authRes);

    // Should return 200 with user info and set auth cookie
    expect(authRes.statusCode).toBe(200);
    const authCookie = authRes.getHeader('Set-Cookie');
    expect(authCookie).toBeDefined();
    
    // Step 2: User navigates to SSO endpoint directly (IdP-initiated)
    const { req: ssoReq, res: ssoRes } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      headers: {
        cookie: String(authCookie),
      },
    });

    // Mock authenticated user
    (userService.verifyToken as jest.Mock).mockReturnValue(mockUser);

    // Call the SSO handler
    await ssoHandler(ssoReq, ssoRes);

    // Should return HTML form with SAML response but no RelayState
    expect(ssoRes.statusCode).toBe(200);
    expect(ssoRes._getHeaders()['content-type']).toBe('text/html');
    const responseBody = ssoRes._getData();
    expect(responseBody.includes('form id="samlform" method="post"')).toBe(true);
    expect(responseBody.includes('name="SAMLResponse"')).toBe(true);
    expect(responseBody.includes('name="RelayState"')).toBe(false);
  });
}); 