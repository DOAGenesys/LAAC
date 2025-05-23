import type { NextApiRequest, NextApiResponse } from 'next';
import { idp, sp, constants } from '@/lib/saml/config';
import { userService } from '@/lib/saml/userService';
import { analyzeSamlResponse, validateSamlTimestamps } from '@/lib/saml/debugUtils';
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
    console.log('[api/saml/sso] ================== SSO HANDLER STARTED ==================');
    console.log('[api/saml/sso] Request method:', req.method);
    console.log('[api/saml/sso] Request URL:', req.url);
    
    // Log request headers (mask sensitive ones)
    const sanitizedHeaders = { ...req.headers };
    if (sanitizedHeaders.cookie) {
      sanitizedHeaders.cookie = sanitizedHeaders.cookie.replace(/auth_token=[^;]+/g, 'auth_token=***MASKED***');
    }
    console.log('[api/saml/sso] Request headers:', JSON.stringify(sanitizedHeaders, null, 2));
    
    // Log query parameters
    console.log('[api/saml/sso] Query parameters:', JSON.stringify(req.query, null, 2));
    
    // Log body if it exists (but mask SAMLRequest content)
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.SAMLRequest) {
        sanitizedBody.SAMLRequest = `***MASKED_SAML_REQUEST_LENGTH_${sanitizedBody.SAMLRequest.length}***`;
      }
      console.log('[api/saml/sso] Request body:', JSON.stringify(sanitizedBody, null, 2));
    }
    
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
    const hasRequest = (req.method === 'GET' && req.query.SAMLRequest) || 
                      (req.method === 'POST' && req.body && req.body.SAMLRequest);
    console.log('[api/saml/sso] Request type:', hasRequest ? 'SP-initiated' : 'IdP-initiated');
    
    // Extract RelayState if present (from query or body)
    const relayState = (req.query.RelayState as string) || 
                      (req.body && req.body.RelayState) || '';
    console.log('[api/saml/sso] RelayState:', relayState || 'none');
    
    // Check if user is authenticated by verifying the auth cookie
    console.log('[api/saml/sso] ================== USER AUTHENTICATION CHECK ==================');
    let user = null;
    
    if (req.headers.cookie) {
      console.log('[api/saml/sso] Cookies found in request');
      const cookies = cookie.parse(req.headers.cookie);
      const cookieNames = Object.keys(cookies);
      console.log('[api/saml/sso] Available cookies:', cookieNames);
      
      if (cookies.auth_token) {
        console.log('[api/saml/sso] Found auth_token cookie, verifying...');
        console.log('[api/saml/sso] Auth token length:', cookies.auth_token.length);
        console.log('[api/saml/sso] Auth token preview:', cookies.auth_token.substring(0, 20) + '***MASKED***');
        
        try {
          user = userService.verifyToken(cookies.auth_token);
          if (user) {
            console.log('[api/saml/sso] ✅ User authentication successful');
            console.log('[api/saml/sso] User email:', user.email);
            console.log('[api/saml/sso] User object keys:', Object.keys(user));
          } else {
            console.log('[api/saml/sso] ❌ Token verification returned null/false');
          }
        } catch (tokenError) {
          console.error('[api/saml/sso] ❌ Error during token verification:', tokenError);
          user = null;
        }
      } else {
        console.log('[api/saml/sso] ❌ No auth_token cookie found');
        console.log('[api/saml/sso] Available cookie names:', cookieNames);
      }
    } else {
      console.log('[api/saml/sso] ❌ No cookies found in request headers');
    }
    
    // If not authenticated, redirect to login page
    if (!user) {
      console.log('[api/saml/sso] User not authenticated, redirecting to login');
      const loginUrl = `/login${relayState ? `?relayState=${encodeURIComponent(relayState)}` : ''}`;
      return res.redirect(loginUrl);
    }
    
    console.log('[api/saml/sso] User authenticated:', user.email);
    
    // Debug information about the IDP and SP objects
    console.log('[api/saml/sso] ================== SAML CONFIGURATION CHECK ==================');
    console.log('[api/saml/sso] IDP entity ID:', idp.entityMeta.getEntityID());
    console.log('[api/saml/sso] SP entity ID:', sp.entityMeta.getEntityID());
    
    // Check certificate data availability
    const idpConfig = idp.entitySetting;
    console.log('[api/saml/sso] IDP Configuration Analysis:');
    console.log('[api/saml/sso] - Private key available:', !!idpConfig.privateKey);
    console.log('[api/saml/sso] - Private key length:', idpConfig.privateKey ? idpConfig.privateKey.length : 0);
    console.log('[api/saml/sso] - Private key type:', typeof idpConfig.privateKey);
    console.log('[api/saml/sso] - Signing cert available:', !!idpConfig.signingCert);
    console.log('[api/saml/sso] - Signing cert length:', idpConfig.signingCert ? idpConfig.signingCert.length : 0);
    console.log('[api/saml/sso] - Signing cert type:', typeof idpConfig.signingCert);
    
    // Log environment variables (masked)
    console.log('[api/saml/sso] Environment Variables Check:');
    console.log('[api/saml/sso] - GENESYS_ACS defined:', !!process.env.GENESYS_ACS);
    console.log('[api/saml/sso] - GENESYS_ORG_SHORT defined:', !!process.env.GENESYS_ORG_SHORT);
    console.log('[api/saml/sso] - GENESYS_ORG_SHORT value:', process.env.GENESYS_ORG_SHORT);
    console.log('[api/saml/sso] - Constants genesysOrgShort:', constants.genesysOrgShort);
    
    // Get the ACS URL from environment or config
    const acsUrl = process.env.GENESYS_ACS || 'https://login.mypurecloud.com/saml';
    console.log('[api/saml/sso] ================== TARGET CONFIGURATION ==================');
    console.log('[api/saml/sso] Using ACS URL:', acsUrl);
    console.log('[api/saml/sso] Expected destination matches ACS:', acsUrl === 'https://login.mypurecloud.ie/saml');
    
    // User is authenticated, create SAML response with the required attributes
    console.log('[api/saml/sso] ================== SAML RESPONSE GENERATION ==================');
    console.log('[api/saml/sso] Creating SAML login response...');
    try {
      // Different approach for IdP-initiated vs SP-initiated flows
      let samlResponse: string;
      
      if (hasRequest) {
        // SP-initiated flow (we have a SAMLRequest parameter)
        console.log('[api/saml/sso] 🔄 Using SP-initiated flow handling');
        console.log('[api/saml/sso] SAMLRequest detected in:', req.method, 'request');
        try {
          // Determine the binding type based on the request method
          const bindingType = req.method === 'POST' ? 'post' : 'redirect';
          console.log('[api/saml/sso] Using binding type:', bindingType);
          
          const { extract } = await idp.parseLoginRequest(sp, bindingType, req);
          console.log('[api/saml/sso] ✅ SAML request parsed successfully');
          console.log('[api/saml/sso] Request ID from SP:', extract.request.id);
          
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
          ServiceName: 'directory',
              }
      }
    );
          console.log('[api/saml/sso] ✅ SP-initiated SAML response created via samlify library');
        } catch (error) {
          console.error('[api/saml/sso] ❌ Error parsing SAML request:', error);
          throw new Error(`Failed to parse SAML request: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // IdP-initiated flow (no SAMLRequest parameter)
        console.log('[api/saml/sso] 🔄 Using IdP-initiated flow (manual XML generation)');
        console.log('[api/saml/sso] No SAMLRequest parameter found, proceeding with IdP-initiated flow');
        
        console.log('[api/saml/sso] Using alternative approach for IdP-initiated flow');
        
        try {
          // Using a modified approach for IdP-initiated flow
          // Use a library utility instead of direct XML manipulation
          
          // Extract IDP cert and key from config
          const privateKey = idpConfig.privateKey;
          const cert = idpConfig.signingCert;
          
          console.log('[api/saml/sso] 📋 Certificate Validation:');
          if (!privateKey || !cert) {
            console.error('[api/saml/sso] ❌ Missing certificates!');
            console.error('[api/saml/sso] - Private key missing:', !privateKey);
            console.error('[api/saml/sso] - Certificate missing:', !cert);
            throw new Error('Missing privateKey or cert in idpConfig');
          }
          console.log('[api/saml/sso] ✅ Both private key and certificate are available');
          
          // Enhanced debugging for certificate data
          console.log('[api/saml/sso] 🔍 Certificate Analysis:');
          console.log('[api/saml/sso] Debug privateKey type:', typeof privateKey);
          console.log('[api/saml/sso] Debug privateKey length:', typeof privateKey === 'string' ? privateKey.length : 'not a string');
          console.log('[api/saml/sso] Debug cert type:', typeof cert);
          console.log('[api/saml/sso] Debug cert length:', typeof cert === 'string' ? cert.length : 'not a string');
          console.log('[api/saml/sso] Debug privateKey contains BEGIN markers:', typeof privateKey === 'string' ? privateKey.includes('BEGIN') : false);
          console.log('[api/saml/sso] Debug cert contains BEGIN markers:', typeof cert === 'string' ? cert.includes('BEGIN') : false);
          
          // Ensure privateKey is a string (simpler approach to avoid type issues)
          const privateKeyString = String(privateKey);
          
          // Generate a unique request ID
          const idpEntityID = idp.entityMeta.getEntityID();
          const spEntityID = sp.entityMeta.getEntityID();
          const requestID = `_${crypto.randomBytes(10).toString('hex')}`;
          
          console.log('[api/saml/sso] 🔧 XML Generation Configuration:');
          console.log('[api/saml/sso] - IDP Entity ID:', idpEntityID);
          console.log('[api/saml/sso] - SP Entity ID:', spEntityID);
          console.log('[api/saml/sso] - Response ID:', requestID);
          console.log('[api/saml/sso] - Target ACS URL:', acsUrl);
          console.log('[api/saml/sso] - User email (NameID):', user.email);
          console.log('[api/saml/sso] - Organization Name:', constants.genesysOrgShort);
          
          console.log('[api/saml/sso] Using manual XML generation and signing');

          // Log specific timestamps before XML generation
          const samlNow = new Date();
          console.log('[api/saml/sso] SAML timestamp about to be generated (ISO):', samlNow.toISOString());
          console.log('[api/saml/sso] SAML timestamp about to be generated (Unix):', samlNow.getTime());
          
          // To account for clock skew, adjust the NotBefore timestamp to be 5 minutes in the past
          const notBeforeTime = new Date(samlNow.getTime() - 5 * 60000); // 5 minutes ago
          const notOnOrAfterTime = new Date(samlNow.getTime() + 5 * 60000); // 5 minutes from now
          const sessionNotOnOrAfterTime = new Date(samlNow.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now
          
          console.log('[api/saml/sso] Using adjusted timestamps to handle clock skew:');
          console.log('[api/saml/sso] - NotBefore:', notBeforeTime.toISOString());
          console.log('[api/saml/sso] - NotOnOrAfter:', notOnOrAfterTime.toISOString());
          console.log('[api/saml/sso] - SessionNotOnOrAfter:', sessionNotOnOrAfterTime.toISOString());
          
          // Generate response XML with adjusted timestamps
          const responseXml = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
               xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
               ID="${requestID}"
               Version="2.0"
               IssueInstant="${samlNow.toISOString()}"
               Destination="${acsUrl}">
  <saml:Issuer>${idpEntityID}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
  </samlp:Status>
  <saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                ID="${crypto.randomBytes(16).toString('hex')}"
                Version="2.0"
                IssueInstant="${samlNow.toISOString()}">
    <saml:Issuer>${idpEntityID}</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress">${user.email}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfterTime.toISOString()}"
                                    Recipient="${acsUrl}" />
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${notBeforeTime.toISOString()}"
                  NotOnOrAfter="${notOnOrAfterTime.toISOString()}">
      <saml:AudienceRestriction>
        <saml:Audience>${spEntityID}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${samlNow.toISOString()}"
                      SessionIndex="${crypto.randomBytes(8).toString('hex')}"
                      SessionNotOnOrAfter="${sessionNotOnOrAfterTime.toISOString()}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
        <saml:AttributeValue xsi:type="xs:string">${user.email}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="OrganizationName" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
        <saml:AttributeValue xsi:type="xs:string">${constants.genesysOrgShort}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="ServiceName" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
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
                    nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
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
      
      // Log the SAML Response for debugging
      console.log('[api/saml/sso] ================== FINAL SAML RESPONSE ==================');
      console.log('[api/saml/sso] SAMLResponse (Base64) length:', samlResponse.length);
      console.log('[api/saml/sso] SAMLResponse (Base64) preview:', samlResponse.substring(0, 100) + '***TRUNCATED***');
      
      // Decode and log key parts of the XML for verification
      try {
        const decodedXml = Buffer.from(samlResponse, 'base64').toString();
        console.log('[api/saml/sso] ✅ Base64 decoding successful');
        console.log('[api/saml/sso] Decoded XML length:', decodedXml.length);
        
        // Use debugging utility for comprehensive analysis
        const analysis = analyzeSamlResponse(samlResponse);
        console.log('[api/saml/sso] 📊 SAML Response Analysis:');
        console.log('[api/saml/sso] - Valid structure:', analysis.valid);
        
        if (analysis.valid) {
          console.log('[api/saml/sso] - Issuer:', analysis.issuer || 'NOT FOUND');
          console.log('[api/saml/sso] - NameID:', analysis.nameId || 'NOT FOUND');
          console.log('[api/saml/sso] - Audience:', analysis.audience || 'NOT FOUND');
          console.log('[api/saml/sso] - Destination:', analysis.destination || 'NOT FOUND');
          console.log('[api/saml/sso] - Contains Signature:', analysis.hasSignature);
          console.log('[api/saml/sso] - Contains AttributeStatement:', analysis.hasAttributeStatement);
          console.log('[api/saml/sso] - Has Success Status:', analysis.hasSuccessStatus);
          
          if (analysis.errors && analysis.errors.length > 0) {
            console.error('[api/saml/sso] ⚠️ SAML Structure Issues:', analysis.errors);
          }
          
          // Log attribute values
          console.log('[api/saml/sso] 🏷️  Attribute Values:');
          if (analysis.attributes) {
            Object.entries(analysis.attributes).forEach(([name, value]) => {
              console.log(`[api/saml/sso] - ${name}:`, value);
            });
          } else {
            console.log('[api/saml/sso] - No attributes found');
          }
          
          // Validate timestamps
          if (analysis.timestamps) {
            const timestampValidation = validateSamlTimestamps(analysis.timestamps);
            console.log('[api/saml/sso] ⏰ Timestamp Validation:');
            console.log('[api/saml/sso] - Valid timestamps:', timestampValidation.valid);
            if (!timestampValidation.valid && timestampValidation.issues) {
              console.error('[api/saml/sso] - Timestamp issues:', timestampValidation.issues);
            }
            console.log('[api/saml/sso] - IssueInstant:', analysis.timestamps.issueInstant);
            console.log('[api/saml/sso] - NotBefore:', analysis.timestamps.notBefore);
            console.log('[api/saml/sso] - NotOnOrAfter:', analysis.timestamps.notOnOrAfter);
          }
        } else {
          console.error('[api/saml/sso] ❌ SAML Analysis failed:', analysis.error);
        }
        
      } catch (decodeError) {
        console.error('[api/saml/sso] ❌ Error decoding SAML response for analysis:', decodeError);
      }
    
    // Create a form for automatic submission
    console.log('[api/saml/sso] ================== FORM SUBMISSION ==================');
    console.log('[api/saml/sso] Preparing HTML form for POST to Genesys Cloud');
    console.log('[api/saml/sso] Target ACS URL:', acsUrl);
    console.log('[api/saml/sso] RelayState present:', !!relayState);
    if (relayState) {
      console.log('[api/saml/sso] RelayState value:', relayState);
    }
    
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
    console.log('[api/saml/sso] ✅ Form HTML generated, sending response with Content-Type: text/html');
    console.log('[api/saml/sso] 🚀 Browser will auto-submit form to:', acsUrl);
    console.log('[api/saml/sso] Form contains SAMLResponse field: true');
    console.log('[api/saml/sso] Form contains RelayState field:', !!relayState);
    console.log('[api/saml/sso] ================== SSO PROCESS COMPLETE ==================');
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(form);
    } catch (samlError) {
      console.error('[api/saml/sso] ❌ Error creating SAML response:', samlError);
      console.error('[api/saml/sso] Error type:', typeof samlError);
      console.error('[api/saml/sso] Error message:', samlError instanceof Error ? samlError.message : String(samlError));
      console.error('[api/saml/sso] Error stack:', samlError instanceof Error ? samlError.stack : 'No stack trace');
      
      // Let's inspect the samlify library arguments in detail
      console.error('[api/saml/sso] IDP object keys:', Object.keys(idp));
      console.error('[api/saml/sso] SP object keys:', Object.keys(sp));
      
      // Re-throw to be caught by the outer catch block
      throw samlError;
    }
  } catch (error) {
    console.error('[api/saml/sso] ================== ERROR IN SSO HANDLER ==================');
    console.error('[api/saml/sso] Error in SSO handler:', error);
    console.error('[api/saml/sso] Error type:', typeof error);
    console.error('[api/saml/sso] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[api/saml/sso] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[api/saml/sso] ================== ERROR END ==================');
    res.status(500).json({ error: 'SAML authentication failed' });
  }
}

// API configuration for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}; 