import * as crypto from 'crypto';
import * as xmlCrypto from 'xml-crypto';
import { DOMParser } from 'xmldom';

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
    // Parse XML to DOM
    const xmlDoc = new DOMParser().parseFromString(xml);
    
    // Create a signing object
    const sig = new xmlCrypto.SignedXml();
    
    // Set the private key
    sig.signingKey = privateKey;
    
    // Add a reference to the root element
    sig.addReference(
      "//*[local-name(.)='Response']",
      [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#'
      ],
      'http://www.w3.org/2001/04/xmlenc#sha256'
    );
    
    // Set the signature algorithm
    sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    
    // Set the canonicalization algorithm
    sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
    
    // Set the key info if a certificate is provided
    if (certificate) {
      // Clean certificate - remove headers and newlines
      const cleanCert = certificate
        .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '')
        .replace(/[\r\n]/g, '');
        
      sig.keyInfoProvider = {
        getKeyInfo: () => {
          return `<X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data>`;
        }
      };
    }
    
    // Compute the signature
    sig.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='Issuer']",
        action: 'after'
      }
    });
    
    // Get the signed XML
    return sig.getSignedXml();
  } catch (error) {
    console.error('Error signing XML:', error);
    throw new Error(`Failed to sign XML: ${error instanceof Error ? error.message : String(error)}`);
  }
} 