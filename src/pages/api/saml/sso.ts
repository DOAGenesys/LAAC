import type { NextApiRequest, NextApiResponse } from 'next';
import { idp, sp, constants } from '@/lib/saml/config';
import { userService } from '@/lib/saml/userService';
import * as cookie from 'cookie';

/**
 * SAML Single Sign-On (SSO) Endpoint
 * 
 * This endpoint handles SAML authentication requests from Genesys Cloud
 * and generates SAML responses after verifying the user's identity.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[api/saml/sso] SSO handler started');
    
    // Check if this is an SP-initiated request (has SAMLRequest parameter)
    const hasRequest = req.method === 'GET' && req.query.SAMLRequest;
    console.log('[api/saml/sso] Request type:', hasRequest ? 'SP-initiated' : 'IdP-initiated');
    
    // Extract RelayState if present
    const relayState = (req.query.RelayState as string) || '';
    console.log('[api/saml/sso] RelayState:', relayState || 'none');
    
    // Check if user is authenticated by verifying the auth cookie
    let user = null;
    
    if (req.headers.cookie) {
      const cookies = cookie.parse(req.headers.cookie);
      if (cookies.auth_token) {
        console.log('[api/saml/sso] Found auth_token cookie, verifying...');
        user = userService.verifyToken(cookies.auth_token);
      } else {
        console.log('[api/saml/sso] No auth_token cookie found');
      }
    } else {
      console.log('[api/saml/sso] No cookies found in request');
    }
    
    // If not authenticated, redirect to login page
    if (!user) {
      console.log('[api/saml/sso] User not authenticated, redirecting to login');
      const loginUrl = `/login${relayState ? `?relayState=${encodeURIComponent(relayState)}` : ''}`;
      return res.redirect(loginUrl);
    }
    
    console.log('[api/saml/sso] User authenticated:', user.email);
    
    // Debug information about the IDP and SP objects
    console.log('[api/saml/sso] IDP entity ID:', idp.entityMeta.getEntityID());
    console.log('[api/saml/sso] SP entity ID:', sp.entityMeta.getEntityID());
    
    // Check certificate data availability
    const idpConfig = idp.entitySetting;
    console.log('[api/saml/sso] IDP cert available:', !!idpConfig.privateKey && idpConfig.privateKey.length > 100);
    console.log('[api/saml/sso] IDP privateKey length:', idpConfig.privateKey ? idpConfig.privateKey.length : 0);
    console.log('[api/saml/sso] IDP cert length:', idpConfig.signingCert ? idpConfig.signingCert.length : 0);
    
    // User is authenticated, create SAML response with the required attributes
    console.log('[api/saml/sso] Creating SAML login response...');
    try {
      const samlResponse = await idp.createLoginResponse(
        sp,
        {
          nameID: user.email,
          nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        'post',
        {
          attributes: {
            email: user.email,
            OrganizationName: constants.genesysOrgShort,
            ServiceName: 'directory', // Redirects to Genesys Cloud Collaborate client
          },
        }
      );
      
      console.log('[api/saml/sso] SAML response created successfully');
      
      // Get the ACS URL from environment or config
      const acsUrl = process.env.GENESYS_ACS || 'https://login.mypurecloud.com/saml';
      console.log('[api/saml/sso] Using ACS URL:', acsUrl);
      
      // Create a form for automatic submission
      const form = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting to Genesys Cloud...</title>
          </head>
          <body>
            <form id="samlform" method="post" action="${acsUrl}">
              <input type="hidden" name="SAMLResponse" value="${samlResponse}" />
              ${relayState ? `<input type="hidden" name="RelayState" value="${relayState}" />` : ''}
              <noscript>
                <p>Please click the button below to continue to Genesys Cloud:</p>
                <button type="submit">Continue</button>
              </noscript>
            </form>
            <script>
              document.getElementById('samlform').submit();
            </script>
          </body>
        </html>
      `;
      
      console.log('[api/saml/sso] Sending HTML form with SAML response');
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(form);
    } catch (samlError) {
      console.error('[api/saml/sso] Error creating SAML response:', samlError);
      // Let's inspect the samlify library arguments in detail
      console.error('[api/saml/sso] IDP object keys:', Object.keys(idp));
      console.error('[api/saml/sso] SP object keys:', Object.keys(sp));
      
      // Re-throw to be caught by the outer catch block
      throw samlError;
    }
  } catch (error) {
    console.error('[api/saml/sso] Error in SSO handler:', error);
    console.error('[api/saml/sso] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'SAML authentication failed' });
  }
} 