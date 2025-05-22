import type { NextApiRequest, NextApiResponse } from 'next';
import { idp } from '@/lib/saml/config';

/**
 * SAML Metadata Endpoint
 * 
 * This endpoint provides the SAML metadata XML for our Identity Provider.
 * Genesys Cloud can use this to configure the SSO integration.
 */
export default function handler(_: NextApiRequest, res: NextApiResponse) {
  try {
    // Get IdP metadata as XML
    const metadata = idp.getMetadata();
    
    // Set content type to XML and return metadata
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(metadata);
  } catch (error) {
    console.error('Error generating IdP metadata:', error);
    res.status(500).json({ error: 'Failed to generate IdP metadata' });
  }
} 