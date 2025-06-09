import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientCredentialsToken } from '../../../lib/oauthService';
import logger from '../../../lib/logger';

interface DivisionQueryResponse {
  entities: {
    id: string;
    name: string;
  }[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { status }: { status: 'compliant' | 'non-compliant' } = req.body;

    if (!status) {
      logger.error('Missing status in request body');
      return res.status(400).json({ error: 'Status is required' });
    }

    let divisionIds: string | undefined;

    if (status === 'compliant') {
      divisionIds = process.env.LAAC_COMPLIANT_DIVISION_IDS;
    } else {
      divisionIds = process.env.LAAC_NON_COMPLIANT_DIVISION_ID;
    }

    if (!divisionIds) {
      logger.error('Division IDs not configured for status', { status });
      return res.status(500).json({ names: [] });
    }
    
    const accessToken = await getClientCredentialsToken();

    logger.info('Fetching division names from Genesys Cloud', { divisionIds });

    const gcResponse = await fetch(
      `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/divisions/query?id=${divisionIds}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!gcResponse.ok) {
      const errorText = await gcResponse.text();
      logger.error('Failed to fetch division names from Genesys Cloud', { 
        status: gcResponse.status,
        error: errorText 
      });
      return res.status(gcResponse.status).json({ error: 'Failed to fetch division names' });
    }

    const data: DivisionQueryResponse = await gcResponse.json();
    const names = data.entities.map(e => e.name);

    logger.info('Successfully fetched division names', { names: names.join(', ') });
    res.status(200).json({ names });

  } catch (error) {
    logger.error('Error fetching division names', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
} 
