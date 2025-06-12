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

export async function listCountries(): Promise<string[]> {
  // Returns the list of countries supported by LAAC. This is derived from the division names coming
  // from Genesys Cloud ("{country} - LAAC") excluding the generic "Non compliant - LAAC" division.
  // The result is cached implicitly because getDivisionMap caches the underlying division map.
  const map = await getDivisionMap();

  const countries: string[] = [];

  for (const divisionName of map.keys()) {
    if (divisionName === 'Non compliant - LAAC') {
      continue; // Skip generic non-compliant division
    }

    const suffix = ' - LAAC';
    if (divisionName.endsWith(suffix)) {
      const country = divisionName.slice(0, -suffix.length).trim();
      if (country && !countries.includes(country)) {
        countries.push(country);
      }
    }
  }

  return countries.sort();
}

/**
 * @deprecated 2024-06 – use listCountries() instead. This function now simply
 * proxies to listCountries for compatibility while ignoring the `type` param.
 */
export function getCountries(_type: 'compliant' | 'alternative' | 'all' = 'all'): string[] {
  // Return a synchronous snapshot of the cached countries if available; otherwise an empty array.
  if (divisionCache) {
    const suffix = ' - LAAC';
    return Array.from(divisionCache.keys())
      .filter(name => name !== 'Non compliant - LAAC' && name.endsWith(suffix))
      .map(name => name.slice(0, -suffix.length).trim())
      .sort();
  }

  // If cache is empty, caller should migrate to async listCountries().
  logger.warn('getCountries() called before division cache populated – returning empty array. Please migrate to listCountries()');
  return [];
} 
