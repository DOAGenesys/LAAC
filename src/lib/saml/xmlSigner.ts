import * as crypto from 'crypto';
import * as xmlCrypto from 'xml-crypto';
import { DOMParser } from 'xmldom';

// Extend the SignedXml type to include properties that exist but aren't in type definitions
interface ExtendedSignedXml extends xmlCrypto.SignedXml {
  signingKey: string | Buffer;
  signatureAlgorithm: string;
  canonicalizationAlgorithm: string;
  keyInfoProvider: {
    getKeyInfo: () => string;
  };
}

/**
 * Verifies if a private key is valid and can be used for signing
 */
function verifyPrivateKey(key: string | Buffer): boolean {
  try {
    // Try to create a sign object with the key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update('test');
    sign.sign(key);
    return true;
  } catch (e) {
    console.error('[xmlSigner] Key verification failed:', e);
    return false;
  }
}

/**
 * Sign an XML document
 * 
 * @param xml The XML document to sign
 * @param privateKey The private key to use for signing
 * @param certificate The certificate to include in the signature
 * @returns The signed XML document
 */
export function signXml(
  xml: string,
  privateKey: string | Buffer,
  certificate?: string
): string {
  try {
    // Enhanced debugging for privateKey
    console.log('[xmlSigner] Private key type:', typeof privateKey);
    console.log('[xmlSigner] Private key length:', privateKey ? (typeof privateKey === 'string' ? privateKey.length : privateKey.length) : 0);
    console.log('[xmlSigner] Private key starts with:', typeof privateKey === 'string' ? privateKey.substring(0, 25) + '...' : 'Buffer');
    console.log('[xmlSigner] Private key contains "BEGIN PRIVATE KEY":', typeof privateKey === 'string' ? privateKey.includes('BEGIN PRIVATE KEY') : false);
    console.log('[xmlSigner] Private key contains "BEGIN RSA PRIVATE KEY":', typeof privateKey === 'string' ? privateKey.includes('BEGIN RSA PRIVATE KEY') : false);
    
    // Verify the key can actually sign something
    console.log('[xmlSigner] Verifying private key is usable with crypto...');
    const keyIsValid = verifyPrivateKey(privateKey);
    console.log('[xmlSigner] Key verification result:', keyIsValid);
    
    if (!keyIsValid && typeof privateKey === 'string') {
      console.log('[xmlSigner] Key appears invalid, trying to clean it...');
      
      // Try to ensure private key is well-formed
      let keyToUse = privateKey;
      
      // Ensure private key has proper line breaks if it doesn't already
      if (!privateKey.includes('\n')) {
        console.log('[xmlSigner] Reformatting private key with proper line breaks');
        const cleanKey = privateKey
          .replace('-----BEGIN PRIVATE KEY-----', '')
          .replace('-----END PRIVATE KEY-----', '')
          .replace('-----BEGIN RSA PRIVATE KEY-----', '')
          .replace('-----END RSA PRIVATE KEY-----', '')
          .replace(/\s/g, '');
          
        const formattedKey = privateKey.includes('RSA PRIVATE KEY') 
          ? `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey.replace(/(.{64})/g, '$1\n')}\n-----END RSA PRIVATE KEY-----`
          : `-----BEGIN PRIVATE KEY-----\n${cleanKey.replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----`;
          
        keyToUse = formattedKey;
        console.log('[xmlSigner] Reformatted key length:', formattedKey.length);
        
        // Verify the reformatted key
        const reformattedKeyIsValid = verifyPrivateKey(keyToUse);
        console.log('[xmlSigner] Reformatted key verification result:', reformattedKeyIsValid);
        
        if (!reformattedKeyIsValid) {
          throw new Error('Unable to create a valid private key for signing');
        }
      }
      privateKey = keyToUse;
    }
    
    // Parse XML to DOM
    const xmlDoc = new DOMParser().parseFromString(xml);
    console.log('[xmlSigner] XML parsed successfully');
    
    // Use crypto's native verification to double check key format 
    console.log('[xmlSigner] Final verification of private key');
    try {
      const signer = crypto.createSign('SHA256');
      signer.update('test-data');
      const signature = signer.sign(privateKey);
      console.log('[xmlSigner] Successfully created a test signature with Node crypto, key is valid');
    } catch (e) {
      console.error('[xmlSigner] Node crypto failed to use private key:', e);
      throw new Error('Private key is not usable with Node crypto');
    }
    
    // Try pure javascript approach with the library
    console.log('[xmlSigner] Creating SignedXml object');
    
    // This avoids TypeScript issues while providing the right runtime arguments
    // @ts-ignore - Constructor expects different args than the type definitions
    const sig = new xmlCrypto.SignedXml() as ExtendedSignedXml;
    console.log('[xmlSigner] Created SignedXml object');
    
    // Set the private key explicitly (critical step)
    sig.signingKey = privateKey;
    console.log('[xmlSigner] Set signingKey on SignedXml object');
    console.log('[xmlSigner] SignedXml object has signingKey:', !!sig.signingKey);
    console.log('[xmlSigner] SignedXml signingKey type:', typeof sig.signingKey);
    
    // Add a reference to the root element using an object argument
    console.log('[xmlSigner] About to call addReference');
    sig.addReference({
      xpath: "//*[local-name(.)='Response']",
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#'
      ],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
    });
    console.log('[xmlSigner] Added reference successfully');
    
    // Set the signature algorithm
    sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    console.log('[xmlSigner] Set signatureAlgorithm');
    
    // Set the canonicalization algorithm
    sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
    console.log('[xmlSigner] Set canonicalizationAlgorithm');
    
    // Set the key info if a certificate is provided
    if (certificate) {
      console.log('[xmlSigner] Certificate provided, length:', certificate.length);
      console.log('[xmlSigner] Certificate starts with:', typeof certificate === 'string' ? certificate.substring(0, 25) + '...' : 'Buffer');
      
      // Clean certificate - remove headers and newlines
      const cleanCert = typeof certificate === 'string' 
        ? certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '').replace(/[\r\n]/g, '')
        : '';
      console.log('[xmlSigner] Cleaned certificate, length:', cleanCert.length);
        
      sig.keyInfoProvider = {
        getKeyInfo: () => {
          return `<X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data>`;
        }
      };
      console.log('[xmlSigner] Set keyInfoProvider');
    } else {
      console.log('[xmlSigner] No certificate provided');
    }

    // Last verification before signing
    console.log('[xmlSigner] Before computeSignature - signingKey exists:', !!sig.signingKey);
    console.log('[xmlSigner] Before computeSignature - signingKey type:', typeof sig.signingKey);
    
    try {
      // Compute the signature
      console.log('[xmlSigner] Attempting to compute signature...');
      sig.computeSignature(xml);
      console.log('[xmlSigner] Signature computed successfully');
    } catch (sigError) {
      console.error('[xmlSigner] Error in computeSignature:', sigError);
      console.error('[xmlSigner] Error details:', JSON.stringify(sigError));
      throw sigError;
    }
    
    // Get the signed XML
    console.log('[xmlSigner] Getting signed XML');
    const signedXml = sig.getSignedXml();
    console.log('[xmlSigner] Signed XML length:', signedXml.length);
    return signedXml;
  } catch (error) {
    console.error('[xmlSigner] Error signing XML:', error);
    console.error('[xmlSigner] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to sign XML: ${error instanceof Error ? error.message : String(error)}`);
  }
} 