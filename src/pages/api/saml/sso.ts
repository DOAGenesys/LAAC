import type { NextApiRequest, NextApiResponse } from 'next';
import { idp, sp, constants } from '@/lib/saml/config';
import { userService } from '@/lib/saml/userService';
import * as cookie from 'cookie';
import * as saml from 'samlify';
import crypto from 'crypto';
import { signXml } from '@/lib/saml/xmlSigner';
import http from 'http';
import https from 'https';

/**
 * SAML Single Sign-On (SSO) Endpoint
 * 
 * This endpoint handles SAML authentication requests from Genesys Cloud
 * and generates SAML responses after verifying the user's identity.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[api/saml/sso] SSO handler started');
    
    // TIMESTAMP LOGGING: Get current time for clock skew diagnosis
    const now = new Date();
    console.log('[api/saml/sso] Vercel server timestamp (ISO):', now.toISOString());
    console.log('[api/saml/sso] Vercel server timestamp (Unix):', now.getTime());
    
    // Get Genesys Cloud time for comparison via HTTP request
    try {
      const genesysTimePromise = new Promise<string>((resolve) => {
        const url = 'https://login.mypurecloud.ie/saml';
        const req = https.request(url, { method: 'HEAD' }, (res) => {
          const dateHeader = res.headers.date;
          resolve(dateHeader || 'No Date header received');
        });
        req.on('error', (err) => {
          console.error('[api/saml/sso] Error fetching Genesys time:', err.message);
          resolve('Error fetching time');
        });
        req.end();
      });
      
      // Set a timeout in case the request takes too long
      const timePromise = Promise.race([
        genesysTimePromise,
        new Promise<string>(resolve => setTimeout(() => resolve('Timeout'), 2000))
      ]);
      
      const genesysTimeHeader = await timePromise;
      console.log('[api/saml/sso] Genesys server time header:', genesysTimeHeader);
      
      if (genesysTimeHeader && genesysTimeHeader !== 'Timeout' && genesysTimeHeader !== 'Error fetching time') {
        const genesysDate = new Date(genesysTimeHeader);
        console.log('[api/saml/sso] Genesys server timestamp (ISO):', genesysDate.toISOString());
        console.log('[api/saml/sso] Genesys server timestamp (Unix):', genesysDate.getTime());
        
        // Calculate and log time difference
        const diffMs = now.getTime() - genesysDate.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffSeconds = Math.floor((diffMs % 60000) / 1000);
        console.log(`[api/saml/sso] CLOCK SKEW: ${diffMinutes} minutes and ${diffSeconds} seconds (${diffMs}ms)`);
        
        if (Math.abs(diffMs) > 60000) { // More than 1 minute difference
          console.warn(`[api/saml/sso] ⚠️ WARNING: Clock skew detected between IdP and SP! This can cause SAML validation failures.`);
        }
      }
    } catch (timeError) {
      console.error('[api/saml/sso] Error checking Genesys time:', timeError);
    }
    
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
    
    // Get the ACS URL from environment or config
    const acsUrl = process.env.GENESYS_ACS || 'https://login.mypurecloud.com/saml';
    console.log('[api/saml/sso] Using ACS URL:', acsUrl);
    
    // User is authenticated, create SAML response with the required attributes
    console.log('[api/saml/sso] Creating SAML login response...');
    try {
      // Different approach for IdP-initiated vs SP-initiated flows
      let samlResponse: string;
      
      if (hasRequest) {
        // SP-initiated flow (we have a SAMLRequest parameter)
        console.log('[api/saml/sso] Using SP-initiated flow handling');
        try {
          const { extract } = await idp.parseLoginRequest(sp, 'redirect', req);
          samlResponse = await idp.createLoginResponse(
            sp,
            {
              inResponseTo: extract.request.id,
              destination: acsUrl,
              nameID: user.email,
              nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
            },
            'post',
            {
              attributes: {
                email: user.email,
                OrganizationName: constants.genesysOrgShort,
                ServiceName: 'directory-admin',
              }
            }
          );
        } catch (error) {
          console.error('[api/saml/sso] Error parsing SAML request:', error);
          throw new Error(`Failed to parse SAML request: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log('[api/saml/sso] Using IdP-initiated flow with samlify createLoginResponse');
        try {
          samlResponse = await idp.createLoginResponse(
            sp,
            {
              destination: acsUrl,
              nameID: user.email,
              nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
            },
            'post',
            {
              attributes: {
                email: user.email,
                OrganizationName: constants.genesysOrgShort,
                ServiceName: 'directory-admin',
              }
            }
          );
          console.log('[api/saml/sso] SAMLResponse created by samlify');
        } catch (error) {
          console.error('[api/saml/sso] Error creating SAML response with samlify:', error);
          throw new Error(`Failed to create SAML response: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      console.log('[api/saml/sso] SAML response created successfully');
      
      // Log the SAML Response for debugging
      console.log('[api/saml/sso] SAMLResponse (Base64):', samlResponse);
    
    // Create a form for automatic submission
    const form = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting to Genesys Cloud...</title>
          <style>
            #debug {
              display: none;
              margin-top: 20px;
              padding: 10px;
              border: 1px solid #ccc;
              background-color: #f5f5f5;
            }
          </style>
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
          <div id="debug">
            <h2>Debug Information</h2>
            <p>If the SSO fails, check the console (F12) for more details.</p>
            <p>The following information may help diagnose issues:</p>
            <ul>
              <li>ACS URL: ${acsUrl}</li>
              <li>IdP Entity ID: ${idp.entityMeta.getEntityID()}</li>
              <li>SP Entity ID: ${sp.entityMeta.getEntityID()}</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
            </ul>
            <button onclick="document.getElementById('samlXml').style.display='block'">Show SAML Response</button>
            <pre id="samlXml" style="display:none;max-height:200px;overflow:auto;white-space:pre-wrap;">${Buffer.from(samlResponse, 'base64').toString()}</pre>
          </div>
          <script>
            // Submit the form automatically
            document.getElementById('samlform').submit();
            
            // Show debug info if there's an error in 3 seconds (in case redirect fails)
            setTimeout(function() {
              document.getElementById('debug').style.display = 'block';
            }, 3000);
            
            // Also capture any errors during submission
            window.onerror = function(message, source, lineno, colno, error) {
              document.getElementById('debug').style.display = 'block';
              const errorInfo = document.createElement('div');
              errorInfo.style.color = 'red';
              errorInfo.innerHTML = '<h3>Error occurred:</h3><p>' + message + '</p>';
              document.getElementById('debug').appendChild(errorInfo);
            };
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