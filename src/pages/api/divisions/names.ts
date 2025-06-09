import type { NextApiRequest, NextApiResponse } from 'next';
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

    logger.info('Received request for division names', { selectedCountry, detectedCountry });

    const allSupportedCountries = getCountries('all');
    logger.info('Loaded country configuration', {
      supported: allSupportedCountries.join(','),
    });

    let divisionNames: string[] = [];
    
    const isMatch = selectedCountry === detectedCountry;
    const isCountrySupported = allSupportedCountries.includes(selectedCountry);

    if (isMatch && isCountrySupported) {
      // Case 1: Compliant
      // A user is compliant if their selected country matches their detected country,
      // and the country is in the list of supported countries.
      // They get access to ALL supported divisions.
      logger.info('Case: User is compliant in a supported country.', { country: selectedCountry });
      divisionNames = allSupportedCountries.map(c => `${c} - LAAC`).sort();

    } else {
      // Case 2: Non-Compliant
      // User is non-compliant if their location doesn't match, or the country isn't supported.
      logger.info('Case: User is non-compliant.', { selectedCountry, detectedCountry, isMatch, isCountrySupported });
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
