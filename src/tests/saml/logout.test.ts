import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/saml/logout';

describe('SAML Logout Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles SP-initiated logout request', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: {
        SAMLRequest: 'mockSAMLLogoutRequest',
      },
    });

    await handler(req, res);

    // Should clear cookie and return success page
    const cookieHeader = res.getHeader('Set-Cookie');
    expect(cookieHeader).toBeDefined();
    expect(String(cookieHeader).includes('auth_token=')).toBe(true);
    
    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Content-Type')).toBe('text/html');
    
    // Check response content
    const html = res._getData();
    expect(html.includes('Successfully logged out')).toBe(true);
  });

  test('handles IdP-initiated logout', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handler(req, res);

    // Should clear cookie and redirect to Genesys logout URL
    const cookieHeader = res.getHeader('Set-Cookie');
    expect(cookieHeader).toBeDefined();
    expect(String(cookieHeader).includes('auth_token=')).toBe(true);
    
    expect(res.statusCode).toBe(302); // Redirect
    expect(res._getRedirectUrl()).toBe('https://login.mypurecloud.ie/saml/logout');
  });
}); 
