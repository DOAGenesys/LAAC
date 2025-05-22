import type { NextApiRequest, NextApiResponse } from 'next';
import { idp, sp } from '@/lib/saml/config';
import cookie from 'cookie';

/**
 * SAML Single Logout (SLO) Endpoint
 * 
 * This endpoint handles logout requests from Genesys Cloud.
 * It processes the request and invalidates the user's session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check if this is a logout request
    const isLogoutRequest = req.method === 'GET' && req.query.SAMLRequest;
    
    // Clear the auth cookie regardless of the request type
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 0, // Expire immediately
        path: '/',
      })
    );
    
    if (isLogoutRequest) {
      // In a real implementation, we would:
      // 1. Parse and validate the SAML logout request
      // 2. Generate a proper logout response
      
      // For now, we'll just acknowledge the logout
      const logoutResponse = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Logged Out</title>
          </head>
          <body>
            <h1>Successfully logged out</h1>
            <p>You have been successfully logged out of the LAAC Identity Provider.</p>
            <p><a href="/login">Return to login</a></p>
          </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(logoutResponse);
    }
    
    // Handle IdP-initiated logout
    // This is a simplified implementation
    const logoutUrl = process.env.GENESYS_SLO || 'https://login.mypurecloud.com/saml/logout';
    
    // In a real implementation, we would generate a proper SAML logout request
    // For now, just redirect to the Genesys logout URL
    return res.redirect(logoutUrl);
  } catch (error) {
    console.error('Error in SLO handler:', error);
    res.status(500).json({ error: 'SAML logout failed' });
  }
} 