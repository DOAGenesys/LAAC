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

    const compliantCountries = getCountries('compliant');
    const alternativeCountries = getCountries('alternative');
    const allSupportedCountries = getCountries('all');
    
    logger.info('Loaded country configuration', {
      compliant: compliantCountries.join(','),
      alternative: alternativeCountries.join(','),
    });

    let divisionNames: string[] = [];
    
    const isMatch = selectedCountry === detectedCountry;
    const isCompliantCountry = compliantCountries.includes(selectedCountry);
    const isAlternativeCountry = alternativeCountries.includes(selectedCountry);

    if (isMatch && isCompliantCountry) {
      // Case 1: Fully Compliant - get access to ALL divisions
      logger.info('Case: User is fully compliant', { country: selectedCountry });
      divisionNames = allSupportedCountries.map(c => `${c} - LAAC`).sort();

    } else if (isMatch && isAlternativeCountry) {
      // Case 2: Alternative Compliant - get access to ONLY their own division
      logger.info('Case: User is alternative compliant', { country: selectedCountry });
      divisionNames = [`${selectedCountry} - LAAC`];
      
    } else {
      // Case 3: Non-Compliant or Out of Scope
      if ((isCompliantCountry || isAlternativeCountry) && !isMatch) {
        // User selected a supported country but their location doesn't match
        logger.info('Case: User is non-compliant (supported country but location mismatch)', { selectedCountry, detectedCountry });
      } else {
        // User selected an unsupported country or "Other"
        logger.info('Case: User is out of scope (unsupported country)', { selectedCountry, detectedCountry });
      }
      
      const nonCompliantId = process.env.LAAC_NON_COMPLIANT_DIVISION_ID;
      if (nonCompliantId) {
        const divisionMap = await getDivisionMap();
        let nonCompliantName = 'Out of scope - LAAC'; // Updated fallback name
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
