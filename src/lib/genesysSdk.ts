import * as platformClient from 'purecloud-platform-client-v2';

// Initialize the client
const client = platformClient.ApiClient.instance;

// Set environment
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GC_REGION) {
  client.setEnvironment(`https://api.${process.env.NEXT_PUBLIC_GC_REGION}`);
}

export const initImplicitGrant = (redirectUri: string): void => {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID) {
    console.error('Cannot initialize implicit grant on server or missing client ID');
    return;
  }

  // Redirect to Genesys Cloud login
  client.loginImplicitGrant(
    process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID,
    redirectUri
  );
};

export const setAccessToken = (token: string): void => {
  if (typeof window === 'undefined') {
    console.error('Cannot set access token on server');
    return;
  }
  
  client.setAccessToken(token);
};

export const getUsersApi = (): platformClient.UsersApi => {
  return new platformClient.UsersApi();
};

export default client; 