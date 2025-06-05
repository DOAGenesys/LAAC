// @ts-ignore - xml-crypto may have incomplete TypeScript definitions
import { SignedXml } from 'xml-crypto';
// @ts-ignore - xmldom may have incomplete TypeScript definitions  
import { DOMParser } from 'xmldom';
import { logger } from './logger';

/**
 * Sign an XML document with a private key using xml-crypto library
 * 
 * This function uses the xml-crypto library which properly implements
 * XML Digital Signature specification for SAML compliance
 * 
 * @param xml The XML document to sign
 * @param privateKey The private key to use for signing
 * @param certificate The certificate to include in the signature
 * @returns The signed XML document
 */
export function signXml(
  xml: string,
  privateKey: string | any,
  certificate?: string
): string {
  try {
    logger.info('xmlSigner', 'Using xml-crypto library for SAML-compliant XML signature');
    logger.debug('xmlSigner', `Private key type: ${typeof privateKey}`);
    logger.debug('xmlSigner', `Private key length: ${privateKey ? (typeof privateKey === 'string' ? privateKey.length : privateKey.length) : 0}`);
    
    if (logger.isDebugEnabled()) {
      logger.debug('xmlSigner', `Private key (FULL):\n${typeof privateKey === 'string' ? privateKey : privateKey.toString()}`);
    }
    
    // Parse the XML document to ensure it's valid
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (!doc || doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML document');
    }
    logger.info('xmlSigner', 'XML parsed successfully');
    
    // Prepare the certificate data for inclusion if provided
    let certData = '';
    if (certificate) {
      // Clean certificate - remove headers and newlines
      certData = typeof certificate === 'string' 
        ? certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '').replace(/[\r\n\s]/g, '')
        : '';
      logger.debug('xmlSigner', `Certificate prepared, length: ${certData.length}`);
      
      if (logger.isDebugEnabled()) {
        logger.debug('xmlSigner', `Certificate (FULL):\n${certificate}`);
      }
    }
    
    // Create a SignedXml instance - use type assertion to bypass incomplete TypeScript definitions
    const sig = new SignedXml({ privateKey: privateKey }) as any;
    
    // Configure signature algorithm and canonicalization  
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    
    // Add reference to the SAML Assertion using proper XPath
    sig.addReference({
      xpath: "//*[local-name(.)='Assertion' and namespace-uri(.)='urn:oasis:names:tc:SAML:2.0:assertion']",
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#'
      ]
    });
    
    // Add certificate to KeyInfo if provided
    if (certificate && certData) {
      // For xml-crypto, we need to set the public certificate
      sig.publicCert = certificate;
    }
    
    logger.info('xmlSigner', 'Configured xml-crypto SignedXml instance');
    
    // Compute the signature - place it inside the Assertion after the Assertion's Issuer
    sig.computeSignature(xml, {
      location: { 
        reference: '//*[local-name(.)="Assertion"]/*[local-name(.)="Issuer"]', 
        action: 'after' 
      }
    });
    
    logger.info('xmlSigner', 'Signature computed successfully');
    
    // Get the signed XML
    const signedXml = sig.getSignedXml();
    
    logger.info('xmlSigner', 'XML signature completed');
    logger.info('xmlSigner', `Signed XML length: ${signedXml.length}`);
    
    return signedXml;
  } catch (error) {
    logger.error('xmlSigner', 'Error signing XML with xml-crypto:', error);
    logger.error('xmlSigner', 'Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to sign XML: ${error instanceof Error ? error.message : String(error)}`);
  }
} 