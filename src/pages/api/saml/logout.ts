import type { NextApiRequest, NextApiResponse } from 'next';
import * as cookie from 'cookie';
import { idp, sp, constants } from '@/lib/saml/config';
import * as querystring from 'querystring';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { userService } from '@/lib/saml/userService';

/**
 * SAML Single Logout (SLO) Endpoint
 * 
 * This endpoint handles logout requests from Genesys Cloud and IdP-initiated logouts.
 * It processes the request and invalidates the user's session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[api/saml/logout] SLO handler started');
    console.log('[api/saml/logout] Request method:', req.method);
    console.log('[api/saml/logout] Query params:', req.query);
    console.log('[api/saml/logout] Headers:', req.headers);
    
    // Get the current user from session before clearing cookies
    let currentUser = null;
    if (req.headers.cookie) {
      const cookies = cookie.parse(req.headers.cookie);
      if (cookies.auth_token) {
        try {
          currentUser = userService.verifyToken(cookies.auth_token);
          console.log('[api/saml/logout] Current user found:', currentUser?.email);
        } catch (error) {
          console.log('[api/saml/logout] Failed to verify user token:', error);
        }
      }
    }

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
      console.log('[api/saml/logout] Processing SP-initiated SAML logout request');
      
      try {
        // Parse the SAML Logout Request
        const { extract } = await idp.parseLogoutRequest(sp, 'redirect', req);
        console.log('[api/saml/logout] Parsed logout request. ID:', extract?.request?.id);
        console.log('[api/saml/logout] Logout request details:', {
          id: extract?.request?.id,
          issuer: extract?.request?.issuer,
          nameID: extract?.request?.nameID,
          sessionIndex: extract?.request?.sessionIndex
        });
        
        // Create a SAML Logout Response
        const relayState = req.query.RelayState as string || '';
        const destination = process.env.GENESYS_SLO || 'https://login.mypurecloud.ie/saml/logout';
        
        console.log('[api/saml/logout] Creating logout response with destination:', destination);
        
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
        
        console.log('[api/saml/logout] SP-initiated logout redirect URL:', redirectUrl);
        
        // Redirect the browser with the logout response
        return res.redirect(redirectUrl);
      } catch (parseError) {
        console.error('[api/saml/logout] Error parsing SAML Logout Request:', parseError);
        console.error('[api/saml/logout] Parse error details:', parseError instanceof Error ? parseError.message : 'Unknown error');
        
        // If we can't parse the logout request, still try to redirect to a safe logout URL
        const fallbackUrl = process.env.GENESYS_SLO || 'https://login.mypurecloud.ie/saml/logout';
        console.log('[api/saml/logout] Falling back to direct logout redirect:', fallbackUrl);
        return res.redirect(fallbackUrl);
      }
    }
    
    // Handle IdP-initiated logout (when user logs out from our app)
    console.log('[api/saml/logout] Processing IdP-initiated logout');
    
    // Get the SP logout URL
    const logoutUrl = process.env.GENESYS_SLO || 'https://login.mypurecloud.ie/saml/logout';
    
    // For IdP-initiated logout, instead of creating a SAML LogoutRequest,
    // just redirect to the Genesys logout URL directly.
    // This avoids potential issues with session matching and NameID format discrepancies.
    console.log('[api/saml/logout] Performing direct logout redirect to avoid SAML complexity');
    console.log('[api/saml/logout] User:', currentUser?.email || 'anonymous');
    console.log('[api/saml/logout] Redirecting to:', logoutUrl);
    
    // Add a query parameter to indicate this is an IdP-initiated logout
    const directLogoutUrl = `${logoutUrl}?idp_logout=true`;
    
    return res.redirect(directLogoutUrl);
    
  } catch (error) {
    console.error('[api/saml/logout] Error in SLO handler:', error);
    console.error('[api/saml/logout] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Even if there's an error, try to redirect to a safe logout URL
    const fallbackUrl = process.env.GENESYS_SLO || 'https://login.mypurecloud.ie/saml/logout';
    console.log('[api/saml/logout] Error occurred, redirecting to fallback URL:', fallbackUrl);
    
    return res.redirect(fallbackUrl);
  }
} 
