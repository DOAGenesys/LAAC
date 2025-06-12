import type { NextApiRequest, NextApiResponse } from 'next';
import logger from '../../../lib/logger';
import { listCountries, getDivisionMap } from '../../../lib/divisionService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { selectedCountry, detectedCountry, fullPermCountry } = req.body;

    if (!selectedCountry || !detectedCountry) {
      return res.status(400).json({ error: 'selectedCountry and detectedCountry are required' });
    }

    logger.info('Received request for division names', { selectedCountry, detectedCountry });

    const allSupportedCountries = await listCountries();
    
    logger.info('Loaded country configuration', {
      supported: allSupportedCountries.join(','),
    });

    let divisionNames: string[] = [];
    
    const fpCountry = fullPermCountry || process.env.NEXT_PUBLIC_LAAC_DEFAULT_COUNTRY_FULL_PERMISSIONS || '';
    const isCompliant = selectedCountry === detectedCountry;
    const isLocationFullPerm = detectedCountry === fpCountry;
    const isCompliantCountryFullPerm = selectedCountry === fpCountry;
    const isDetectedCountrySupported = allSupportedCountries.includes(detectedCountry);

    if (isCompliant) {
      // C == L
      if (isLocationFullPerm) {
        // full-perm country gives all divisions
        divisionNames = allSupportedCountries.map(c => `${c} - LAAC`).sort();
      } else {
        divisionNames = [`${detectedCountry} - LAAC`];
      }
    } else {
      // C != L
      if (isCompliantCountryFullPerm && isDetectedCountrySupported) {
        // Compliant country is full-perm but location differs -> list location division
        divisionNames = [`${detectedCountry} - LAAC`];
      } else {
        // All other mismatches -> Non compliant division
        const nonCompliantId = process.env.LAAC_NON_COMPLIANT_DIVISION_ID || process.env.LAAC_OUT_OF_SCOPE_DIVISION_ID;
        if (nonCompliantId) {
          const divisionMap = await getDivisionMap();
          let nonCompliantName = 'Non compliant - LAAC';
          for (const [name, id] of divisionMap.entries()) {
            if (id === nonCompliantId) {
              nonCompliantName = name;
              break;
            }
          }
          divisionNames = [nonCompliantName];
        } else {
          logger.error('LAAC_NON_COMPLIANT_DIVISION_ID is not set');
          divisionNames = ['Non compliant division not configured'];
        }
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
