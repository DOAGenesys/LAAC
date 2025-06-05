import * as crypto from 'crypto';
import { DOMParser, XMLSerializer } from 'xmldom';
import { logger } from './logger';

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
    logger.error('xmlSigner', 'Key verification failed:', e);
    return false;
  }
}

/**
 * Sign an XML document with a private key
 * 
 * This function uses Node.js crypto module directly instead of xml-crypto
 * which has inconsistent behavior with key formats
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
    logger.info('xmlSigner', 'Using direct Node crypto implementation');
    logger.debug('xmlSigner', `Private key type: ${typeof privateKey}`);
    logger.debug('xmlSigner', `Private key length: ${privateKey ? (typeof privateKey === 'string' ? privateKey.length : privateKey.length) : 0}`);
    
    if (logger.isDebugEnabled()) {
      logger.debug('xmlSigner', `Private key (FULL):\n${typeof privateKey === 'string' ? privateKey : privateKey.toString()}`);
    }
    
    // Verify the key can actually sign something
    if (!verifyPrivateKey(privateKey)) {
      throw new Error('Private key verification failed');
    }
    
    // Parse the XML document
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    logger.info('xmlSigner', 'XML parsed successfully');
    
    // Prepare the certificate data for inclusion if provided
    let certData = '';
    if (certificate) {
      // Clean certificate - remove headers and newlines
      certData = typeof certificate === 'string' 
        ? certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '').replace(/[\r\n]/g, '')
        : '';
      logger.debug('xmlSigner', `Certificate prepared, length: ${certData.length}`);
      
      if (logger.isDebugEnabled()) {
        logger.debug('xmlSigner', `Certificate (FULL):\n${certificate}`);
      }
    }
    
    // Create a digest of the document using SHA256
    const canonicalXml = xml.trim();
    const signedInfoXml = `
<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  <ds:Reference URI="">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>${crypto.createHash('sha256').update(canonicalXml).digest('base64')}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>`.trim();
    
    logger.info('xmlSigner', 'Created SignedInfo XML');
    
    // Calculate the signature value
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signedInfoXml);
    const signatureValue = sign.sign(privateKey, 'base64');
    logger.info('xmlSigner', 'Created signature value');
    
    // Create the complete signature element
    const signatureXml = `
<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  ${signedInfoXml}
  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
  ${certificate ? `
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>${certData}</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>` : ''}
</ds:Signature>`.trim();
    
    logger.info('xmlSigner', 'Created complete signature XML');
    
    // Insert the signature after the Issuer element as specified in your original configuration
    const responseMatch = /<saml:Issuer[^>]*>.*?<\/saml:Issuer>/;
    const signedXml = xml.replace(responseMatch, (match) => {
      return `${match}\n${signatureXml}`;
    });
    
    logger.info('xmlSigner', 'Inserted signature into XML document');
    logger.info('xmlSigner', `Signed XML length: ${signedXml.length}`);
    
    return signedXml;
  } catch (error) {
    logger.error('xmlSigner', 'Error signing XML:', error);
    logger.error('xmlSigner', 'Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to sign XML: ${error instanceof Error ? error.message : String(error)}`);
  }
} 