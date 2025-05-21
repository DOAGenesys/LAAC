import { useEffect, useState } from 'react';
import Head from 'next/head';
import { setAccessToken, getUsersApi } from '../lib/genesysSdk';
import { getEnvironmentVariables } from '../lib/env';
import type { GenesysUser, DivisionSwitchResponse } from '../types/genesys';
import axios from 'axios';

export default function Callback() {
  const [status, setStatus] = useState<'loading' | 'switching' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log('Callback: Main effect - Mounting');

    const processTokenAndSwitchDivision = async () => {
      console.log('Callback: processTokenAndSwitchDivision called.');
      // setStatus('loading') is the initial state, no need to reset unless retrying
      setErrorMessage(null); // Clear previous errors on new attempt

      try {
        if (typeof window === 'undefined') {
          console.log('Callback: SSR context, token processing deferred to client-side.');
          // isLoading will remain true until client-side effect runs.
          return;
        }
        
        console.log('Callback: Verifying Genesys SDK and extracting token...');
        // The SDK functions (setAccessToken, getUsersApi) will now ensure SDK is loaded and initialized.

        if (!window.location.hash) {
          throw new Error('URL hash is missing, cannot extract access token.');
        }

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');

        if (!accessToken) {
          throw new Error('access_token not found in URL hash.');
        }
        console.log('Callback: Access token retrieved.');

        await setAccessToken(accessToken); // Waits for SDK init + sets token
        console.log('Callback: Access token set in SDK.');
        
        console.log('Callback: Fetching user details.');
        const usersApi = await getUsersApi(); // Waits for SDK init + gets API
        const meResponse = await usersApi.getUsersMe({ expand: ['geolocation'] }); // removed 'null' from expand array as it might be invalid
        console.log('Callback: User details fetched.', meResponse);
        
        const userId = meResponse.id;
        const country = meResponse.geolocation?.country || '';
        const currentDivisionId = meResponse.division?.id || '';
        console.log(`Callback: User ID: ${userId}, Country: ${country}, Current Division: ${currentDivisionId}`);
        
        if (!userId) throw new Error('User ID not found in profile response.');
        if (!currentDivisionId) {
          // If division is truly optional or might be missing, handle gracefully or log warning.
          // For now, treating as an error if critical for division switch.
          throw new Error('User current division information is missing. Cannot proceed with division check.');
        }
        
        const env = getEnvironmentVariables();
        console.log('Callback: Initiating division switch API call.');
        setStatus('switching');
        await axios.post<DivisionSwitchResponse>('/api/division-switch', {
          userId,
          country,
          currentDivisionId
        });
        console.log('Callback: Division switch API call successful.');
        
        setStatus('redirecting');
        const redirectUrl = `https://apps.${env.GC_REGION}`;
        console.log(`Callback: Redirecting to Genesys Cloud UI: ${redirectUrl}`);
        window.location.href = redirectUrl;

      } catch (error) {
        console.error('Callback: Error during token processing or division switch:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred.');
      }
    };

    if (typeof window !== 'undefined') {
      processTokenAndSwitchDivision();
    } else {
      console.log("Callback: Skipping token processing on server side.");
    }

  }, []); // Runs once on mount

  // Optional: Log state changes for debugging
  useEffect(() => {
    console.log(`Callback: State Update - Status: ${status}, Error: ${errorMessage}`);
  }, [status, errorMessage]);

  return (
    <>
      <Head>
        <title>LAAC - Processing Login</title>
        <meta name="description" content="Processing login and division assignment" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        {/* SDK script tag is now managed by genesysSdk.ts */}
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          {(status === 'loading') && (
            <>
              <h1 className="text-2xl font-semibold">Initializing & Verifying Location...</h1>
              <p className="mt-4">Please wait while we prepare the application and check your profile.</p>
            </>
          )}
          {status === 'switching' && (
            <>
              <h1 className="text-2xl font-semibold">Updating Division Assignment...</h1>
              <p className="mt-4">We're ensuring you're in the correct division based on your location.</p>
            </>
          )}
          {status === 'redirecting' && (
            <>
              <h1 className="text-2xl font-semibold">Process Complete!</h1>
              <p className="mt-4">Redirecting you to Genesys Cloud...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <h1 className="text-2xl font-semibold text-red-600">Application Error</h1>
              <p className="mt-4 break-words">{errorMessage || 'An unexpected error occurred. Please try again or contact support.'}</p>
              <button 
                className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => window.location.href = '/'}
              >
                Retry Login
              </button>
            </>
          )}
          
          {(status === 'loading' || status === 'switching') && (
            <div className="mt-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          )}

          {process.env.NODE_ENV === 'development' && (
             <div className="mt-8 p-4 bg-gray-100 rounded text-left text-xs">
              <h2 className="font-semibold mb-2">Debug Info (Callback Page):</h2>
              <p>Current Status: {status}</p>
              <p>Error Message: {errorMessage || 'None'}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 