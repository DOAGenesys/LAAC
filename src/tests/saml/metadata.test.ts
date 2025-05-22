import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/saml/metadata';

describe('SAML Metadata Endpoint', () => {
  test('returns XML content type', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toEqual(200);
    expect(res._getHeaders()['content-type']).toEqual('application/xml');
  });

  test('response contains SAML metadata elements', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handler(req, res);

    const responseBody = res._getData();
    
    // Check for common SAML metadata elements
    expect(responseBody.includes('EntityDescriptor')).toBeTruthy();
    expect(responseBody.includes('IDPSSODescriptor')).toBeTruthy();
    expect(responseBody.includes('SingleSignOnService')).toBeTruthy();
    expect(responseBody.includes('X509Certificate')).toBeTruthy();
  });
}); 