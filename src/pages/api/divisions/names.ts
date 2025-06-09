import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientCredentialsToken } from '../../../lib/oauthService';
import logger from '../../../lib/logger';
import { getCountries, getDivisionMap } from '../../../lib/divisionService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { selectedCountry, detectedCountry } = req.body;

    if (!selectedCountry || !detectedCountry) {
      return res.status(400).json({ error: 'selectedCountry and detectedCountry are required' });
    }

    const compliantCountries = getCountries('compliant');
    const allSupportedCountries = getCountries('all');

    let divisionNames: string[] = [];
    const isSelectedCountrySupported = allSupportedCountries.includes(selectedCountry);
    const isCompliant = isSelectedCountrySupported && detectedCountry === selectedCountry;

    logger.info('Determining division names based on compliance', { selectedCountry, detectedCountry, isCompliant });

    if (isCompliant) {
      if (compliantCountries.includes(selectedCountry)) {
        // Fully compliant: all supported countries
        divisionNames = allSupportedCountries.map(c => `${c} - LAAC`);
      } else {
        // Alternative compliant: just their own country
        divisionNames = [`${selectedCountry} - LAAC`];
      }
    } else {
      // Non-compliant
      const nonCompliantId = process.env.LAAC_NON_COMPLIANT_DIVISION_ID;
      if (nonCompliantId) {
        const divisionMap = await getDivisionMap();
        let nonCompliantName = 'Uncompliant - LAAC'; // Fallback
        for (const [name, id] of divisionMap.entries()) {
          if (id === nonCompliantId) {
            nonCompliantName = name;
            break;
          }
        }
        divisionNames = [nonCompliantName];
      } else {
        logger.error('LAAC_NON_COMPLIANT_DIVISION_ID is not set');
        divisionNames = ['Non-Compliant Division Not Configured'];
      }
    }
    
    logger.info('Successfully determined division names', { names: divisionNames.join(', ') });
    res.status(200).json({ names: divisionNames });

  } catch (error) {
    logger.error('Error fetching division names', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
} 
