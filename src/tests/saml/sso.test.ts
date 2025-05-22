import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/saml/sso';
import { userService } from '@/lib/saml/userService';

// Mock userService
jest.mock('@/lib/saml/userService', () => ({
  verifyToken: jest.fn(),
  findByEmail: jest.fn(),
}));

describe('SAML SSO Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SP-initiated flow', () => {
    test('redirects to login page if user is not authenticated', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {
          SAMLRequest: 'mockSAMLRequest',
          RelayState: 'mockRelayState',
        },
      });

      // Mock userService to return null (unauthenticated)
      (userService.verifyToken as jest.Mock).mockReturnValue(null);

      await handler(req, res);

      expect(res._getStatusCode()).toEqual(302); // Redirect
      expect(res._getRedirectUrl()).toEqual('/login?relayState=mockRelayState');
    });

    test('generates SAML response when user is authenticated', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {
          SAMLRequest: 'mockSAMLRequest',
          RelayState: 'mockRelayState',
        },
        headers: {
          cookie: 'auth_token=valid-token',
        },
      });

      // Mock userService to return authenticated user
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
      };
      (userService.verifyToken as jest.Mock).mockReturnValue(mockUser);

      await handler(req, res);

      expect(res._getStatusCode()).toEqual(200);
      expect(res._getHeaders()['content-type']).toEqual('text/html');
      
      // Check that response contains the SAML form with appropriate values
      const responseBody = res._getData();
      expect(responseBody.includes('form id="samlform" method="post"')).toBeTruthy();
      expect(responseBody.includes('name="SAMLResponse" value="mockSAMLResponse"')).toBeTruthy();
      expect(responseBody.includes('name="RelayState" value="mockRelayState"')).toBeTruthy();
    });
  });

  describe('IdP-initiated flow', () => {
    test('redirects to login page if user is not authenticated', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      // Mock userService to return null (unauthenticated)
      (userService.verifyToken as jest.Mock).mockReturnValue(null);

      await handler(req, res);

      expect(res._getStatusCode()).toEqual(302); // Redirect
      expect(res._getRedirectUrl()).toEqual('/login');
    });

    test('generates SAML response when user is authenticated', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          cookie: 'auth_token=valid-token',
        },
      });

      // Mock userService to return authenticated user
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
      };
      (userService.verifyToken as jest.Mock).mockReturnValue(mockUser);

      await handler(req, res);

      expect(res._getStatusCode()).toEqual(200);
      expect(res._getHeaders()['content-type']).toEqual('text/html');
      
      // Check that response contains the SAML form but without RelayState
      const responseBody = res._getData();
      expect(responseBody.includes('form id="samlform" method="post"')).toBeTruthy();
      expect(responseBody.includes('name="SAMLResponse" value="mockSAMLResponse"')).toBeTruthy();
      expect(responseBody.includes('name="RelayState"')).toBeFalsy();
    });
  });
}); 