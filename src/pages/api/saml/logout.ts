import type { NextApiRequest, NextApiResponse } from 'next';
import * as cookie from 'cookie';
import { idp, sp, constants } from '@/lib/saml/config';
import * as querystring from 'querystring';
import * as zlib from 'zlib';
import * as crypto from 'crypto';

/**
 * SAML Single Logout (SLO) Endpoint
 * 
 * This endpoint handles logout requests from Genesys Cloud.
 * It processes the request and invalidates the user's session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[api/saml/logout] SLO handler started');
    console.log('[api/saml/logout] Request method:', req.method);
    console.log('[api/saml/logout] Query params:', req.query);

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
    
    // Check if this is a SAML logout request from the SP (Genesys Cloud)
    const isLogoutRequest = req.method === 'GET' && req.query.SAMLRequest;
    
    if (isLogoutRequest) {
      console.log('[api/saml/logout] Processing SAML logout request');
      
      try {
        // Parse the SAML Logout Request
        const { extract } = await idp.parseLogoutRequest(sp, 'redirect', req);
        console.log('[api/saml/logout] Parsed logout request. ID:', extract?.request?.id);
        
        // Create a SAML Logout Response
        const relayState = req.query.RelayState as string || '';
        const destination = process.env.GENESYS_SLO || 'https://login.mypurecloud.ie/saml/logout';
        
        // Create the logout response XML
        const logoutResponseContext = await idp.createLogoutResponse(
          sp, 
          {
            inResponseTo: extract?.request?.id,
            destination: destination,
            // Success status code
            statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success'
          },
          'redirect'
        );
        
        console.log('[api/saml/logout] Generated SAML logout response');
        
        // Extract the redirect URL from the binding context
        const redirectUrl = typeof logoutResponseContext === 'string' 
          ? logoutResponseContext 
          : logoutResponseContext.context || '';
        
        // Redirect the browser with the logout response
        return res.redirect(redirectUrl);
      } catch (parseError) {
        console.error('[api/saml/logout] Error parsing SAML Logout Request:', parseError);
        return res.status(400).json({ error: 'Invalid SAML Logout Request' });
      }
    }
    
    // Handle IdP-initiated logout (when user logs out from our app)
    console.log('[api/saml/logout] Processing IdP-initiated logout');
    
    // Get the SP logout URL
    const logoutUrl = process.env.GENESYS_SLO || 'https://login.mypurecloud.ie/saml/logout';
    
    try {
      // For IdP-initiated logout, we need to generate a proper SAML LogoutRequest
      // In a real-world implementation, we should also include session information
      const logoutRequestContext = await idp.createLogoutRequest(
        sp,
        {
          // We need to use the same nameID format and value used during login
          nameID: req.query.email as string || 'user@example.com',
          nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          destination: logoutUrl
        },
        'redirect'
      );
      
      console.log('[api/saml/logout] Generated SAML IdP-initiated logout request');
      
      // Extract the redirect URL from the binding context
      const requestRedirectUrl = typeof logoutRequestContext === 'string'
        ? logoutRequestContext
        : logoutRequestContext.context || '';
      
      // Redirect the browser with the logout request
      return res.redirect(requestRedirectUrl);
    } catch (error) {
      console.error('[api/saml/logout] Error creating SAML logout request:', error);
      
      // Fallback: just redirect to SP's logout URL if we can't create a proper SAML request
      console.log('[api/saml/logout] Falling back to direct logout URL redirect');
      return res.redirect(logoutUrl);
    }
  } catch (error) {
    console.error('[api/saml/logout] Error in SLO handler:', error);
    console.error('[api/saml/logout] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'SAML logout failed' });
  }
} 