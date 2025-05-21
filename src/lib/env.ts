/**
 * Environment variable utilities
 * This creates a more reliable approach to accessing environment variables in Next.js
 */

export const getEnvironmentVariables = () => {
  return {
    GC_REGION: process.env.NEXT_PUBLIC_GC_REGION || '',
    GC_IMPLICIT_CLIENT_ID: process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID || '',
    LAAC_COMPLIANT_COUNTRY: process.env.NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY || '',
  };
};

// Helper function to check if we're on the server
export const isServer = () => typeof window === 'undefined'; 