/**
 * Environment variable utilities
 * This creates a more reliable approach to accessing environment variables in Next.js
 */

interface GenesysEnvironmentVariables {
  GC_REGION: string;
  GC_IMPLICIT_CLIENT_ID: string;
  LAAC_COMPLIANT_COUNTRY: string;
  GEOCODE_API_KEY: string;
}

// Map region identifiers to Genesys Cloud region hosts
export const GENESYS_REGION_HOSTS: { [key: string]: string } = {
  'mypurecloud.com': 'us_east_1',
  'mypurecloud.com.au': 'ap_southeast_2',
  'mypurecloud.jp': 'ap_northeast_1',
  'mypurecloud.ie': 'eu_west_1',
  'mypurecloud.de': 'eu_central_1',
  'usw2.pure.cloud': 'us_west_2',
  'cac1.pure.cloud': 'ca_central_1',
  'aps1.pure.cloud': 'ap_south_1',
  'euw2.pure.cloud': 'eu_west_2',
  'apne2.pure.cloud': 'ap_northeast_2',
  'sae1.pure.cloud': 'sa_east_1',
  'use2.pure.cloud': 'us_east_2'
};

export const getEnvironmentVariables = (): GenesysEnvironmentVariables => {
  return {
    GC_REGION: process.env.NEXT_PUBLIC_GC_REGION || '',
    GC_IMPLICIT_CLIENT_ID: process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID || '',
    LAAC_COMPLIANT_COUNTRY: process.env.NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY || '',
    GEOCODE_API_KEY: process.env.NEXT_PUBLIC_GEOCODE_API_KEY || '',
  };
};

// Helper function to check if we're on the server
export const isServer = () => typeof window === 'undefined'; 