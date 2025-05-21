// We'll use a dynamic import pattern to only load the Genesys SDK on the client side
import { getEnvironmentVariables, isServer, GENESYS_REGION_HOSTS } from './env';

// Define types for the Genesys client
interface GenesysClient {
  loginImplicitGrant: (clientId: string, redirectUri: string, options?: any) => Promise<any>;
  setAccessToken: (token: string) => void;
  setEnvironment: (url: string) => void;
}

interface GenesysApiClient {
  instance: GenesysClient;
  PureCloudRegionHosts: { [key: string]: string };
}

// For use in the browser
let platformClient: any = null;

// Initialize the client (browser-only)
if (!isServer()) {
  try {
    // In browser environments, the SDK is loaded via script tag and available globally
    platformClient = (window as any).require('platformClient');
  } catch (e) {
    console.error('Failed to load Genesys Platform Client', e);
  }
}

/**
 * Initialize the implicit grant flow for authentication
 */
export const initImplicitGrant = async (redirectUri: string): Promise<void> => {
  // Get environment variables
  const env = getEnvironmentVariables();
  
  // Debug environment variables
  console.log('Debug - GC_REGION:', env.GC_REGION ? 'SET' : 'NOT SET');
  console.log('Debug - GC_IMPLICIT_CLIENT_ID:', env.GC_IMPLICIT_CLIENT_ID ? 'SET' : 'NOT SET');
  
  if (isServer() || !platformClient) {
    console.error('Cannot initialize implicit grant on server or platformClient not loaded');
    return;
  }
  
  if (!env.GC_IMPLICIT_CLIENT_ID) {
    console.error('Missing NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID environment variable');
    return;
  }

  try {
    // Get instance from platformClient
    const client = platformClient.ApiClient.instance;
    
    // Set environment if region is available
    if (env.GC_REGION) {
      // Check if we have a predefined region constant or use the direct URL
      const regionKey = GENESYS_REGION_HOSTS[env.GC_REGION];
      
      if (regionKey && platformClient.PureCloudRegionHosts[regionKey]) {
        console.log(`Using predefined region: ${regionKey}`);
        client.setEnvironment(platformClient.PureCloudRegionHosts[regionKey]);
      } else {
        console.log(`Using direct API URL: https://api.${env.GC_REGION}`);
        client.setEnvironment(`https://api.${env.GC_REGION}`);
      }
    } else {
      console.error('Missing NEXT_PUBLIC_GC_REGION environment variable');
    }

    // Redirect to Genesys Cloud login
    console.log('Debug - About to call loginImplicitGrant');
    await client.loginImplicitGrant(env.GC_IMPLICIT_CLIENT_ID, redirectUri);
  } catch (error) {
    console.error('Failed to initialize Genesys client:', error);
    throw error;
  }
};

/**
 * Set the access token for API requests
 */
export const setAccessToken = (token: string): void => {
  if (isServer() || !platformClient) {
    console.error('Cannot set access token on server or platformClient not loaded');
    return;
  }
  
  try {
    const client = platformClient.ApiClient.instance;
    client.setAccessToken(token);
  } catch (error) {
    console.error('Failed to set access token:', error);
  }
};

/**
 * Get the Users API instance
 */
export const getUsersApi = (): any => {
  if (isServer() || !platformClient) {
    throw new Error('Cannot get UsersApi on server or platformClient not loaded');
  }
  
  try {
    return new platformClient.UsersApi();
  } catch (error) {
    console.error('Failed to get UsersApi:', error);
    throw error;
  }
};

// Export the SDK functions
export default {
  initImplicitGrant,
  setAccessToken,
  getUsersApi
}; 