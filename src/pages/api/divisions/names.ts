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
    const isDetectedCountrySupported = allSupportedCountries.includes(detectedCountry);

    if (isMatch && isDetectedCountrySupported) {
      // Case 1: Compliant - both match and detected country is supported
      // Show ALL supported divisions
      logger.info('Case: User is compliant', { selectedCountry, detectedCountry });
      divisionNames = allSupportedCountries.map(c => `${c} - LAAC`).sort();

    } else if (!isMatch && isDetectedCountrySupported) {
      // Case 2: Non-Compliant - countries don't match but detected country is supported
      // Show only detected country's division
      logger.info('Case: User is non-compliant', { selectedCountry, detectedCountry });
      divisionNames = [`${detectedCountry} - LAAC`];
      
    } else {
      // Case 3: Out of scope - detected country is not supported (like "Other")
      logger.info('Case: User is out of scope', { selectedCountry, detectedCountry });
      const outOfScopeId = process.env.LAAC_OUT_OF_SCOPE_DIVISION_ID || process.env.LAAC_NON_COMPLIANT_DIVISION_ID;
      if (outOfScopeId) {
        const divisionMap = await getDivisionMap();
        let outOfScopeName = 'Out of scope - LAAC'; // Fallback name
        for (const [name, id] of divisionMap.entries()) {
          if (id === outOfScopeId) {
            outOfScopeName = name;
            break;
          }
        }
        divisionNames = [outOfScopeName];
      } else {
        logger.error('LAAC_OUT_OF_SCOPE_DIVISION_ID is not set');
        divisionNames = ['Out of scope division not configured'];
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
