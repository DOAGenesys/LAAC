import { getClientCredentialsToken } from './oauthService';
import logger from './logger';

interface Division {
  id: string;
  name: string;
}

let divisionCache: Map<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAllDivisions(accessToken: string): Promise<Division[]> {
  const allDivisions: Division[] = [];
  let page = 1;
  const pageSize = 100;

  logger.info('Fetching all divisions from Genesys Cloud');

  while (true) {
    const url = `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/divisions?pageNumber=${page}&pageSize=${pageSize}&sortBy=name`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch divisions from Genesys Cloud', { 
        status: response.status,
        error: errorText
      });
      throw new Error('Failed to fetch divisions');
    }

    const data = await response.json();
    if (data.entities) {
      allDivisions.push(...data.entities);
    }

    if (!data.nextUri) {
      break;
    }
    page++;
  }
  
  logger.info(`Fetched a total of ${allDivisions.length} divisions`);
  return allDivisions;
}

export async function getDivisionMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (divisionCache && now - cacheTimestamp < CACHE_TTL) {
    logger.info('Returning divisions from cache');
    return divisionCache;
  }

  logger.info('Cache expired or empty, fetching fresh divisions from Genesys Cloud API');
  const accessToken = await getClientCredentialsToken();
  const allDivisions = await fetchAllDivisions(accessToken);

  const newCache = new Map<string, string>();
  for (const division of allDivisions) {
    if (division.name && division.id) {
      newCache.set(division.name, division.id);
    }
  }

  divisionCache = newCache;
  cacheTimestamp = now;

  logger.info(`Successfully cached ${divisionCache.size} divisions`);
  return divisionCache;
}

export function getDivisionIdFromMap(map: Map<string, string>, country: string): string | undefined {
  const divisionName = `${country} - LAAC`;
  const divisionId = map.get(divisionName);
  
  if (!divisionId) {
    logger.warn('Could not find division ID for country in map', { divisionName });
  }

  return divisionId;
}

export function getCountries(type: 'compliant' | 'alternative' | 'all'): string[] {
    const compliant = (process.env.LAAC_COMPLIANT_COUNTRIES || '').split(',').map(c => c.trim()).filter(Boolean);
    const alternative = (process.env.LAAC_ALTERNATIVE_COUNTRIES || '').split(',').map(c => c.trim()).filter(Boolean);
    
    if (type === 'compliant') return compliant;
    if (type === 'alternative') return alternative;
    
    return [...new Set([...compliant, ...alternative])];
} 
