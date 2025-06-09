import type { NextApiRequest, NextApiResponse } from 'next';
import { getCountries } from '../../lib/divisionService';
import logger from '../../lib/logger';

interface CountriesResponse {
  countries: string[];
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<CountriesResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const allCountries = getCountries('all').sort();
    allCountries.push('Other');
    
    logger.info('Serving list of supported countries, including "Other"', { count: allCountries.length });

    res.status(200).json({ countries: allCountries });
  } catch (error) {
    logger.error('Failed to get countries from environment variables', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ countries: [] });
  }
} 
