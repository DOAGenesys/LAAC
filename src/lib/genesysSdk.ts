// We'll use a dynamic import pattern to only load the Genesys SDK on the client side
import { getEnvironmentVariables, isServer } from './env';

// Define types for the Genesys client
interface GenesysClient {
  loginImplicitGrant: (clientId: string, redirectUri: string, options?: any) => Promise<any>;
  setAccessToken: (token: string) => void;
  setEnvironment: (url: string) => void;
}

interface GenesysApiClient {
  instance: GenesysClient;
  PureCloudRegionHosts: { [key: string]: string }; // Although not directly used for setEnvironment, it's part of the type
}

// Module-level promise to ensure SDK is loaded and initialized only once
let sdkInitializationPromise: Promise<any> | null = null;
let internalPlatformClient: any = null; // Store the resolved platformClient

const SDK_SCRIPT_ID = 'genesys-sdk-script';
const SDK_SRC = 'https://sdk-cdn.mypurecloud.com/javascript/213.1.0/purecloud-platform-client-v2.min.js'; // Pinning version for stability
const LOAD_TIMEOUT_MS = 20000; // Increased to 20 seconds timeout for SDK loading
const POLLING_INTERVAL_MS = 100; // Poll every 100ms

/**
 * Ensures the Genesys SDK script is loaded and platformClient is initialized.
 * Manages script injection, polling for window.platformClient, and API client instance setup.
 */
const ensureSdkLoadedAndInitialized = (): Promise<any> => {
  if (isServer()) {
    console.error('SDK initialization cannot occur on the server.');
    return Promise.reject(new Error('SDK cannot be initialized on the server.'));
  }

  if (sdkInitializationPromise) {
    return sdkInitializationPromise;
  }

  sdkInitializationPromise = new Promise((resolve, reject) => {
    if ((window as any).platformClient && internalPlatformClient) {
      console.log('SDK already loaded and initialized.');
      resolve(internalPlatformClient);
      return;
    }

    console.log('Attempting to load and initialize Genesys SDK...');

    const scriptLoadHandler = () => {
      console.log('Genesys Platform Client SDK SCRIPT LOADED (onload event)');
      let attempts = 0;
      const maxAttempts = LOAD_TIMEOUT_MS / POLLING_INTERVAL_MS;

      const pollForPlatformClient = setInterval(() => {
        if ((window as any).platformClient) {
          clearInterval(pollForPlatformClient);
          console.log('platformClient FOUND on window object.');
          internalPlatformClient = (window as any).platformClient;
          const env = getEnvironmentVariables();

          if (!internalPlatformClient.ApiClient.instance) {
            console.error("ApiClient.instance is undefined after platformClient is found.");
            sdkInitializationPromise = null; // Reset for next attempt
            internalPlatformClient = null;   // Reset for next attempt
            reject(new Error("Failed to initialize SDK: ApiClient.instance is undefined."));
            return;
          }
          
          if (env.GC_REGION) {
            console.log(`Setting Genesys Cloud environment to: ${env.GC_REGION}`);
            internalPlatformClient.ApiClient.instance.setEnvironment(env.GC_REGION);
          } else {
            console.warn('GC_REGION is not set. SDK environment might not be configured correctly.');
            // Depending on requirements, you might want to reject or handle this differently
          }
          resolve(internalPlatformClient);
        } else {
          attempts++;
          if (attempts > maxAttempts) {
            clearInterval(pollForPlatformClient);
            console.error('Timed out waiting for platformClient to become available on window.');
            reject(new Error('SDK Load Timeout: platformClient not found on window.'));
          } else {
            console.log(`Polling for platformClient... Attempt ${attempts}. Window.platformClient is:`, (window as any).platformClient);
          }
        }
      }, POLLING_INTERVAL_MS);
    };

    const scriptErrorHandler = (event: Event | string) => {
      console.error('Genesys Platform Client SDK SCRIPT FAILED TO LOAD', event);
      reject(new Error('Failed to load Genesys SDK script.'));
    };

    let script = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement;
    if (script) {
      console.log('SDK script tag already exists. Assuming it is loaded or loading.');
      // If script exists, it might have loaded or failed.
      // If platformClient is not yet available, onload handler above will take care of polling.
      // If it already loaded successfully, the initial check for window.platformClient would have caught it.
      // If it failed, we might not catch it here unless we re-attach listeners,
      // but scriptErrorHandler won't fire for an already failed script.
      // For simplicity, we let the polling mechanism handle it.
      // A more robust solution might involve checking script.readyState or an equivalent.
      if ((window as any).platformClient){
        scriptLoadHandler(); // Trigger handler if platformClient somehow appeared.
      } else {
        // If script exists but platformClient not yet there, re-attach listeners
        // This is a fallback, ideally this state means it's still loading
        console.warn("Re-attaching listeners to existing script tag. This might indicate an unusual state.");
        script.removeEventListener('load', scriptLoadHandler); // Remove any old listeners
        script.removeEventListener('error', scriptErrorHandler);
        script.addEventListener('load', scriptLoadHandler);
        script.addEventListener('error', scriptErrorHandler);
        // If the script has already loaded but platformClient isn't there, it's a problem.
        // The polling will handle timeout.
      }
    } else {
      console.log('Creating and appending Genesys SDK script tag...');
      script = document.createElement('script');
      script.id = SDK_SCRIPT_ID;
      script.src = SDK_SRC;
      script.async = true;
      script.addEventListener('load', scriptLoadHandler);
      script.addEventListener('error', scriptErrorHandler);
      document.head.appendChild(script);
    }
  });

  return sdkInitializationPromise;
};

/**
 * Get the platform client from global scope (after ensuring it's loaded and initialized)
 */
export const getPlatformClient = (): any => {
  if (isServer()) {
    // This function might be called in contexts where an error isn't fatal,
    // so just returning null and letting caller handle it.
    return null;
  }
  // ensureSdkLoadedAndInitialized should populate this
  return internalPlatformClient;
};

/**
 * Initialize the implicit grant flow for authentication
 */
export const initImplicitGrant = async (redirectUri: string): Promise<void> => {
  if (isServer()) {
    console.error('Cannot init implicit grant on server.');
    return;
  }

  await ensureSdkLoadedAndInitialized();
  const platformClient = getPlatformClient(); // Should now be available

  if (!platformClient) {
    console.error('Cannot initialize implicit grant: Platform client not available after initialization.');
    // This case should ideally not be reached if ensureSdkLoadedAndInitialized resolves correctly.
    throw new Error('Platform client not available after SDK initialization attempt.');
  }

  const env = getEnvironmentVariables();
  console.log('Debug - GC_IMPLICIT_CLIENT_ID:', env.GC_IMPLICIT_CLIENT_ID ? 'SET' : 'NOT SET');
  console.log('Debug - Redirect URI:', redirectUri);

  if (!env.GC_IMPLICIT_CLIENT_ID) {
    console.error('Missing NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID environment variable');
    throw new Error('Missing Client ID for implicit grant.');
  }

  try {
    const client = platformClient.ApiClient.instance;
    // Environment is set during ensureSdkLoadedAndInitialized
    console.log('Attempting to call loginImplicitGrant...');
    await client.loginImplicitGrant(env.GC_IMPLICIT_CLIENT_ID, redirectUri);
  } catch (error) {
    console.error('Failed to initialize Genesys client or execute loginImplicitGrant:', error);
    // Reset the promise so that next attempt will try to load the SDK again
    sdkInitializationPromise = null; 
    internalPlatformClient = null;
    throw error;
  }
};

/**
 * Set the access token for API requests
 */
export const setAccessToken = async (token: string): Promise<void> => {
  if (isServer()) {
    // Silently return on server, or log an info message
    console.info('setAccessToken called on server. No operation performed.');
    return;
  }

  await ensureSdkLoadedAndInitialized();
  const platformClient = getPlatformClient();

  if (!platformClient) {
    console.error('Cannot set access token: Platform client not loaded.');
    // This should not happen if ensureSdkLoadedAndInitialized worked
    return;
  }
  
  try {
    const client = platformClient.ApiClient.instance;
    client.setAccessToken(token);
    console.log('Access token set successfully.');
  } catch (error) {
    console.error('Failed to set access token:', error);
    // Potentially reset sdkInitializationPromise here as well if this is a critical failure point
  }
};

/**
 * Get the Users API instance
 */
export const getUsersApi = async (): Promise<any> => {
  if (isServer()) {
    throw new Error('Cannot get UsersApi on server.');
  }

  await ensureSdkLoadedAndInitialized();
  const platformClient = getPlatformClient();

  if (!platformClient) {
    console.error('Cannot get UsersApi: Platform client not loaded after initialization.');
    throw new Error('Platform client not loaded when trying to get UsersApi.');
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
  getUsersApi,
  getPlatformClient, // Exposing this though direct use should be limited
  ensureSdkLoadedAndInitialized // Exposing for potential direct use or testing
}; 