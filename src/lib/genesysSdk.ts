// We'll use a dynamic import pattern to only load the Genesys SDK on the client side
import { getEnvironmentVariables, isServer } from './env';

// Type definition for the Genesys client
interface GenesysClient {
  ApiClient: {
    instance: {
      setEnvironment: (url: string) => void;
      loginImplicitGrant: (clientId: string, redirectUri: string) => void;
      setAccessToken: (token: string) => void;
    };
  };
  UsersApi: new () => any;
}

// Initialize empty client for type safety
let platformClient: GenesysClient | null = null;

// Function to load the client dynamically (only in browser)
const loadClient = async (): Promise<GenesysClient> => {
  if (isServer()) {
    throw new Error('Cannot load Genesys client on server side');
  }

  if (!platformClient) {
    // Dynamically import the client library
    platformClient = await import('purecloud-platform-client-v2');
  }
  
  return platformClient;
};

export const initImplicitGrant = async (redirectUri: string): Promise<void> => {
  // Get environment variables in a reliable way
  const env = getEnvironmentVariables();
  
  // Debug environment variables - only log sanitized version
  console.log('Debug - GC_REGION:', env.GC_REGION ? 'SET' : 'NOT SET');
  console.log('Debug - GC_IMPLICIT_CLIENT_ID:', env.GC_IMPLICIT_CLIENT_ID ? 'SET' : 'NOT SET');
  
  if (isServer()) {
    console.error('Cannot initialize implicit grant on server');
    return;
  }
  
  if (!env.GC_IMPLICIT_CLIENT_ID) {
    console.error('Missing NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID environment variable');
    return;
  }

  try {
    const client = await loadClient();
    
    // Set environment if region is available
    if (env.GC_REGION) {
      client.ApiClient.instance.setEnvironment(`https://api.${env.GC_REGION}`);
    } else {
      console.error('Missing NEXT_PUBLIC_GC_REGION environment variable');
    }

    // Redirect to Genesys Cloud login
    console.log('Debug - About to call loginImplicitGrant');
    client.ApiClient.instance.loginImplicitGrant(
      env.GC_IMPLICIT_CLIENT_ID,
      redirectUri
    );
  } catch (error) {
    console.error('Failed to initialize Genesys client:', error);
  }
};

export const setAccessToken = async (token: string): Promise<void> => {
  if (isServer()) {
    console.error('Cannot set access token on server');
    return;
  }
  
  try {
    const client = await loadClient();
    client.ApiClient.instance.setAccessToken(token);
  } catch (error) {
    console.error('Failed to set access token:', error);
  }
};

export const getUsersApi = async (): Promise<any> => {
  if (isServer()) {
    throw new Error('Cannot get UsersApi on server');
  }
  
  try {
    const client = await loadClient();
    return new client.UsersApi();
  } catch (error) {
    console.error('Failed to get UsersApi:', error);
    throw error;
  }
};

// No default export for client to prevent accidental server-side usage
export default {
  initImplicitGrant,
  setAccessToken,
  getUsersApi
}; 