import type { NextApiRequest, NextApiResponse } from 'next';
import { idp, sp, constants } from '@/lib/saml/config';
import { userService } from '@/lib/saml/userService';
import * as cookie from 'cookie';
import * as saml from 'samlify';
import crypto from 'crypto';
import { signXml } from '@/lib/saml/xmlSigner';

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
              nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            },
            'post',
            {
              attributes: {
                email: user.email,
                OrganizationName: constants.genesysOrgShort,
                ServiceName: 'directory', // Redirects to Genesys Cloud Collaborate client
              }
            }
          );
        } catch (error) {
          console.error('[api/saml/sso] Error parsing SAML request:', error);
          throw new Error(`Failed to parse SAML request: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // IdP-initiated flow (no SAMLRequest parameter)
        console.log('[api/saml/sso] Using alternative approach for IdP-initiated flow');
        
        try {
          // Using a modified approach for IdP-initiated flow
          // Use a library utility instead of direct XML manipulation
          
          // Extract IDP cert and key from config
          const privateKey = idpConfig.privateKey;
          const cert = idpConfig.signingCert;
          
          if (!privateKey || !cert) {
            throw new Error('Missing privateKey or cert in idpConfig');
          }
          
          // Enhanced debugging for certificate data
          console.log('[api/saml/sso] Debug privateKey type:', typeof privateKey);
          console.log('[api/saml/sso] Debug privateKey length:', typeof privateKey === 'string' ? privateKey.length : 'not a string');
          console.log('[api/saml/sso] Debug cert type:', typeof cert);
          console.log('[api/saml/sso] Debug cert length:', typeof cert === 'string' ? cert.length : 'not a string');
          console.log('[api/saml/sso] Debug privateKey contains BEGIN markers:', typeof privateKey === 'string' ? privateKey.includes('BEGIN') : false);
          
          // Ensure privateKey is a string (simpler approach to avoid type issues)
          const privateKeyString = String(privateKey);
          
          // Generate a unique request ID
          const idpEntityID = idp.entityMeta.getEntityID();
          const spEntityID = sp.entityMeta.getEntityID();
          const requestID = `_${crypto.randomBytes(10).toString('hex')}`;
          
          console.log('[api/saml/sso] Using manual XML generation and signing');
          
          // Generate response XML 
          const responseXml = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
               xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
               ID="${requestID}"
               Version="2.0"
               IssueInstant="${new Date().toISOString()}"
               Destination="${acsUrl}">
  <saml:Issuer>${idpEntityID}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
  </samlp:Status>
  <saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                ID="${crypto.randomBytes(16).toString('hex')}"
                Version="2.0"
                IssueInstant="${new Date().toISOString()}">
    <saml:Issuer>${idpEntityID}</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${user.email}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${new Date(Date.now() + 5 * 60000).toISOString()}"
                                    Recipient="${acsUrl}" />
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${new Date().toISOString()}"
                  NotOnOrAfter="${new Date(Date.now() + 5 * 60000).toISOString()}">
      <saml:AudienceRestriction>
        <saml:Audience>${spEntityID}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${new Date().toISOString()}"
                      SessionIndex="${crypto.randomBytes(8).toString('hex')}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue xsi:type="xs:string">${user.email}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="OrganizationName">
        <saml:AttributeValue xsi:type="xs:string">${constants.genesysOrgShort}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="ServiceName">
        <saml:AttributeValue xsi:type="xs:string">directory</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
          `.trim();
          
          console.log('[api/saml/sso] Response XML generated, signing with private key');
          console.log('[api/saml/sso] XML length:', responseXml.length);
          
          // Try with direct privateKey
          console.log('[api/saml/sso] Using privateKey directly without conversion');
          try {
            // Use our custom XML signer
            const signedResponse = signXml(
              responseXml, 
              privateKey, 
              typeof cert === 'string' ? cert : String(cert)
            );
            
            console.log('[api/saml/sso] Response signed successfully');
            samlResponse = Buffer.from(signedResponse).toString('base64');
          } catch (signError) {
            console.error('[api/saml/sso] Error during XML signing:', signError);
            
            // Try with extra conversion as fallback
            console.log('[api/saml/sso] First attempt failed, trying alternative key format');
            try {
              // Try Buffer conversion if it's a string
              const altKey = typeof privateKey === 'string' ? Buffer.from(privateKey) : privateKey;
              console.log('[api/saml/sso] Alternative key type:', typeof altKey);
              console.log('[api/saml/sso] Alternative key is Buffer:', Buffer.isBuffer(altKey));
              
              const signedResponse = signXml(
                responseXml,
                altKey,
                typeof cert === 'string' ? cert : String(cert)
              );
              
              console.log('[api/saml/sso] Second sign attempt succeeded');
              samlResponse = Buffer.from(signedResponse).toString('base64');
            } catch (retryError) {
              console.error('[api/saml/sso] Second sign attempt also failed:', retryError);
              
              // Last resort: Try using samlify's utility directly
              console.log('[api/saml/sso] Trying samlify utility as last resort');
              try {
                // Create a login response using idp.createLoginResponse
                console.log('[api/saml/sso] Using idp.createLoginResponse');
                const loginResponse = await idp.createLoginResponse(
                  sp,
                  { 
                    nameID: user.email,
                    nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                    destination: acsUrl
                  },
                  'post',
                  {
                    attributes: {
                      email: user.email,
                      OrganizationName: constants.genesysOrgShort,
                      ServiceName: 'directory'
                    }
                  }
                );
                
                console.log('[api/saml/sso] Samlify login response created successfully');
                samlResponse = loginResponse;
              } catch (samlifyError) {
                console.error('[api/saml/sso] All signing methods failed:', samlifyError);
                throw samlifyError;
              }
            }
          }
          
        } catch (error) {
          console.error('[api/saml/sso] Error creating manual SAML response:', error);
          throw new Error(`Failed to create SAML response: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      console.log('[api/saml/sso] SAML response created successfully');
      
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