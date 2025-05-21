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

// For use in the browser - will be populated after script loads
let platformClient: any = null;

/**
 * Get the platform client - should only be called after script loads
 */
export const getPlatformClient = (): any => {
  if (isServer()) {
    console.error('Cannot access platform client on server');
    return null;
  }
  
  // In browser environments, after script loads, platformClient is directly available as a global
  if (!platformClient) {
    platformClient = (window as any).platformClient;
  }
  
  if (!platformClient) {
    console.error('Platform client not loaded yet. Make sure the script has loaded.');
  }
  
  return platformClient;
};

/**
 * Initialize the implicit grant flow for authentication
 */
export const initImplicitGrant = async (redirectUri: string): Promise<void> => {
  // Get environment variables
  const env = getEnvironmentVariables();
  
  // Debug environment variables
  console.log('Debug - GC_REGION:', env.GC_REGION ? 'SET' : 'NOT SET');
  console.log('Debug - GC_IMPLICIT_CLIENT_ID:', env.GC_IMPLICIT_CLIENT_ID ? 'SET' : 'NOT SET');
  
  const client = getPlatformClient();
  
  if (!client) {
    console.error('Cannot initialize implicit grant: Platform client not loaded');
    return;
  }
  
  if (!env.GC_IMPLICIT_CLIENT_ID) {
    console.error('Missing NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID environment variable');
    return;
  }

  try {
    // Get instance from platformClient
    const apiClient = client.ApiClient.instance;
    
    // Set environment if region is available
    if (env.GC_REGION) {
      // Check if we have a predefined region constant or use the direct URL
      const regionKey = GENESYS_REGION_HOSTS[env.GC_REGION];
      
      if (regionKey && client.PureCloudRegionHosts && client.PureCloudRegionHosts[regionKey]) {
        console.log(`Using predefined region: ${regionKey}`);
        apiClient.setEnvironment(client.PureCloudRegionHosts[regionKey]);
      } else {
        console.log(`Using direct API URL: https://api.${env.GC_REGION}`);
        apiClient.setEnvironment(`https://api.${env.GC_REGION}`);
      }
    } else {
      console.error('Missing NEXT_PUBLIC_GC_REGION environment variable');
    }

    // Redirect to Genesys Cloud login
    console.log('Debug - About to call loginImplicitGrant');
    await apiClient.loginImplicitGrant(env.GC_IMPLICIT_CLIENT_ID, redirectUri);
  } catch (error) {
    console.error('Failed to initialize Genesys client:', error);
    throw error;
  }
};

/**
 * Set the access token for API requests
 */
export const setAccessToken = (token: string): void => {
  const client = getPlatformClient();
  
  if (!client) {
    console.error('Cannot set access token: Platform client not loaded');
    return;
  }
  
  try {
    const apiClient = client.ApiClient.instance;
    apiClient.setAccessToken(token);
  } catch (error) {
    console.error('Failed to set access token:', error);
  }
};

/**
 * Get the Users API instance
 */
export const getUsersApi = (): any => {
  const client = getPlatformClient();
  
  if (!client) {
    throw new Error('Cannot get UsersApi: Platform client not loaded');
  }
  
  try {
    return new client.UsersApi();
  } catch (error) {
    console.error('Failed to get UsersApi:', error);
    throw error;
  }
};

// Export the SDK functions
export default {
  initImplicitGrant,
  setAccessToken,
  getUsersApi,
  getPlatformClient
}; 