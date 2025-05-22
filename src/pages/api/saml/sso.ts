import type { NextApiRequest, NextApiResponse } from 'next';
import { idp, sp, constants } from '@/lib/saml/config';
import { userService } from '@/lib/saml/userService';
import cookie from 'cookie';

/**
 * SAML Single Sign-On (SSO) Endpoint
 * 
 * This endpoint handles SAML authentication requests from Genesys Cloud
 * and generates SAML responses after verifying the user's identity.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check if this is an SP-initiated request (has SAMLRequest parameter)
    const hasRequest = req.method === 'GET' && req.query.SAMLRequest;
    
    // Extract RelayState if present
    const relayState = (req.query.RelayState as string) || '';
    
    // Check if user is authenticated by verifying the auth cookie
    let user = null;
    
    if (req.headers.cookie) {
      const cookies = cookie.parse(req.headers.cookie);
      if (cookies.auth_token) {
        user = userService.verifyToken(cookies.auth_token);
      }
    }
    
    // If not authenticated, redirect to login page
    if (!user) {
      const loginUrl = `/login${relayState ? `?relayState=${encodeURIComponent(relayState)}` : ''}`;
      return res.redirect(loginUrl);
    }
    
    // User is authenticated, create SAML response with the required attributes
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
    
    // Get the ACS URL from environment or config
    const acsUrl = process.env.GENESYS_ACS || 'https://login.mypurecloud.com/saml';
    
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
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(form);
  } catch (error) {
    console.error('Error in SSO handler:', error);
    res.status(500).json({ error: 'SAML authentication failed' });
  }
} 