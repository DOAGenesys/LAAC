import { useEffect, useState } from 'react';
import Head from 'next/head';
import { setAccessToken, getUsersApi } from '../lib/genesysSdk';
import { getEnvironmentVariables } from '../lib/env';
import type { GenesysUser, DivisionSwitchResponse } from '../types/genesys';
import axios from 'axios';

export default function Callback() {
  const [status, setStatus] = useState<'loading' | 'switching' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState<boolean>(false);

  useEffect(() => {
    console.log('Callback component mounted');

    // Function to load and initialize the Genesys SDK
    const loadAndInitSdk = () => {
      console.log('Callback: loadAndInitSdk called');
      if (typeof window === 'undefined') {
        console.log('Callback: Window is undefined, skipping SDK load (SSR)');
        return;
      }

      // Check if platformClient is already on window
      if ((window as any).platformClient) {
        console.log('Callback: platformClient already exists on window. Processing token.');
        setSdkReady(true);
        processToken();
        return;
      }

      // If not, try to load it dynamically
      let script = document.getElementById('genesys-platform-client-sdk') as HTMLScriptElement;
      if (!script) {
        console.log('Callback: Genesys Platform Client SDK script not found, creating and appending...');
        script = document.createElement('script');
        script.id = 'genesys-platform-client-sdk';
        script.src = 'https://sdk-cdn.mypurecloud.com/javascript/213.1.0/purecloud-platform-client-v2.min.js';
        // script.async = false; // Not strictly needed if handled by onload

        script.onload = () => {
          console.log('Callback: Genesys Platform Client SDK SCRIPT LOADED (onload event)');
          if ((window as any).platformClient) {
            console.log('Callback: platformClient IS NOW AVAILABLE on window after onload. Processing token.');
            setSdkReady(true);
            processToken();
          } else {
            console.error('Callback: platformClient STILL NOT AVAILABLE on window after onload event.');
            setStatus('error');
            setErrorMessage('Genesys SDK loaded but platformClient global object not found. This is unexpected.');
          }
        };

        script.onerror = (event: Event | string) => {
          console.error('Callback: Failed to load Genesys Platform Client SDK SCRIPT:', event);
          setStatus('error');
          setErrorMessage('Failed to load Genesys SDK script. Check network and console for details.');
        };
        document.head.appendChild(script);
        console.log('Callback: Genesys SDK script appended to head.');
      } else {
        console.log('Callback: Genesys SDK script element already exists in DOM. Waiting for it to potentially load or re-checking.');
        setTimeout(() => {
          if ((window as any).platformClient) {
            console.log('Callback: platformClient became available after a short delay.');
            setSdkReady(true);
            processToken();
          } else if (status !== 'error') { // only set error if no other error occurred
            console.error('Callback: platformClient still not available after delay, script tag existed.');
            // setStatus('error');
            // setErrorMessage('Genesys SDK script was present but failed to initialize platformClient globally.');
          }
        }, 500);
      }
    };

    loadAndInitSdk();

  }, []); // Empty dependency array ensures this runs once on mount
  
  // Debug logs for state changes
  useEffect(() => {
    console.log(`Callback SDK Ready State: ${sdkReady}, Status: ${status}, Error Message: ${errorMessage}`);
  }, [sdkReady, status, errorMessage]);


  const processToken = async () => {
    console.log('Callback: processToken called');
    if (typeof window === 'undefined' || !(window as any).platformClient) {
      console.error('Callback: Attempted to process token, but platformClient not available on window.');
      setStatus('error');
      setErrorMessage('Genesys SDK not ready or not found when trying to process token.');
      return;
    }

    try {
      console.log('Callback: platformClient found, proceeding with token processing.');
      // Parse access token from URL hash
      if (!window.location.hash) {
        throw new Error('No token found in URL (hash is empty)');
      }

      const hashParams = new URLSearchParams(
        window.location.hash.substring(1) // remove the # character
      );
      const accessToken = hashParams.get('access_token');

      if (!accessToken) {
        throw new Error('No access_token parameter found in URL hash');
      }
      console.log('Callback: Access token retrieved from URL.');

      // Set the token in the SDK
      setAccessToken(accessToken);
      console.log('Callback: Access token set in SDK.');

      // Get user profile with geolocation
      setStatus('loading');
      console.log('Callback: Fetching user details...');
      const usersApi = getUsersApi();
      const meResponse = await usersApi.getUsersMe({ expand: ['geolocation', 'null'] });
      console.log('Callback: User details fetched:', meResponse);
      
      // Extract user data
      const userId = meResponse.id;
      const country = meResponse.geolocation?.country || '';
      const currentDivisionId = meResponse.division?.id || '';
      console.log(`Callback: User ID: ${userId}, Country: ${country}, Current Division: ${currentDivisionId}`);
      
      if (!currentDivisionId) {
        throw new Error('User division information is missing from Genesys Cloud profile.');
      }
      
      // Get environment variables
      const env = getEnvironmentVariables();
      console.log('Callback: Environment variables for division switch:', env);
      
      // Determine target division based on country (logic is on the server)
      console.log('Callback: Initiating division switch API call...');
      setStatus('switching');
      const apiResponse = await axios.post<DivisionSwitchResponse>('/api/division-switch', {
        userId,
        country,
        currentDivisionId
      });
      console.log('Callback: Division switch API response:', apiResponse.data);
      
      // Redirect to Genesys Cloud UI
      setStatus('redirecting');
      const redirectUrl = `https://apps.${env.GC_REGION}`;
      console.log(`Callback: Redirecting to Genesys Cloud UI: ${redirectUrl}`);
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Callback: Error processing token or during API calls:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred during token processing.');
    }
  };

  return (
    <>
      <Head>
        <title>LAAC - Processing Login</title>
        <meta name="description" content="Processing login and division assignment" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          {status === 'loading' && (
            <>
              <h1 className="text-2xl font-semibold">Verifying your location...</h1>
              <p className="mt-4">Please wait while we check your profile information.</p>
            </>
          )}
          {status === 'switching' && (
            <>
              <h1 className="text-2xl font-semibold">Updating division assignment...</h1>
              <p className="mt-4">We're ensuring you're in the correct division based on your location.</p>
            </>
          )}
          {status === 'redirecting' && (
            <>
              <h1 className="text-2xl font-semibold">Division verified!</h1>
              <p className="mt-4">Redirecting you to Genesys Cloud...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <h1 className="text-2xl font-semibold text-red-600">Error occurred</h1>
              <p className="mt-4">{errorMessage || 'An unexpected error occurred during processing.'}</p>
              <button 
                className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => window.location.href = '/'}
              >
                Try Again
              </button>
            </>
          )}
          
          {(status === 'loading' || status === 'switching') && (
            <div className="mt-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 