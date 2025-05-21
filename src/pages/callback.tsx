import { useEffect, useState } from 'react';
import Head from 'next/head';
import { setAccessToken, getUsersApi, getPlatformClient } from '../lib/genesysSdk';
import { getEnvironmentVariables } from '../lib/env';
import type { GenesysUser, DivisionSwitchResponse } from '../types/genesys';
import axios from 'axios';

export default function Callback() {
  const [status, setStatus] = useState<'loading' | 'switching' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load the SDK scripts
    const loadGenesysSDK = () => {
      // Create a script element for the SDK
      const script = document.createElement('script');
      script.id = 'genesys-platform-client';
      // Using the same version as in the example
      script.src = 'https://sdk-cdn.mypurecloud.com/javascript/213.1.0/purecloud-platform-client-v2.min.js';
      script.async = false;
      
      script.onload = () => {
        console.log('Genesys Platform Client SDK loaded');
        
        // Wait a brief moment to ensure the global variable is registered
        setTimeout(() => {
          if (typeof window !== 'undefined' && (window as any).platformClient) {
            console.log('platformClient is available');
            processToken();
          } else {
            console.error('platformClient not available after script load');
            setStatus('error');
            setErrorMessage('Genesys SDK loaded but platformClient is not available. Try refreshing the page.');
          }
        }, 100);
      };
      
      script.onerror = () => {
        console.error('Failed to load Genesys SDK');
        setStatus('error');
        setErrorMessage('Failed to load Genesys SDK. Please check your connection and try again.');
      };
      
      // Make sure scripts are added to head
      document.head.appendChild(script);
    };
    
    if (typeof window !== 'undefined') {
      if ((window as any).platformClient) {
        console.log('Genesys SDK already available');
        processToken();
      } else {
        loadGenesysSDK();
      }
    }
  }, []);

  const processToken = async () => {
    try {
      // Verify SDK is loaded
      if (typeof window === 'undefined' || !(window as any).platformClient) {
        throw new Error('Genesys SDK not loaded');
      }

      // Parse access token from URL hash
      if (!window.location.hash) {
        throw new Error('No token found in URL');
      }

      const hashParams = new URLSearchParams(
        window.location.hash.substring(1) // remove the # character
      );
      const accessToken = hashParams.get('access_token');

      if (!accessToken) {
        throw new Error('No access token found in URL');
      }

      // Set the token in the SDK
      setAccessToken(accessToken);

      // Get user profile with geolocation
      setStatus('loading');
      const usersApi = getUsersApi();
      const meResponse = await usersApi.getUsersMe({ expand: ['geolocation', 'null'] });
      
      // Extract user data
      const userId = meResponse.id;
      const country = meResponse.geolocation?.country || '';
      const currentDivisionId = meResponse.division?.id || '';
      
      if (!currentDivisionId) {
        throw new Error('User division information is missing');
      }
      
      // Get environment variables
      const env = getEnvironmentVariables();
      
      // Determine target division based on country
      const isCompliant = country === env.LAAC_COMPLIANT_COUNTRY;
      
      // We don't have direct access to these env vars on the client
      // So we'll pass the country to the API and let it determine the correct division
      
      // Only call API if division needs to change
      // For this we need to make another request to the server API
      setStatus('switching');
      const apiResponse = await axios.post<DivisionSwitchResponse>('/api/division-switch', {
        userId,
        country,
        currentDivisionId
      });
      
      // Redirect to Genesys Cloud UI
      setStatus('redirecting');
      window.location.href = `https://apps.${env.GC_REGION}`;
    } catch (error) {
      console.error('Error processing token:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  return (
    <>
      <Head>
        <title>LAAC - Processing Login</title>
        <meta name="description" content="Processing login and division assignment" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        {/* Include the SDK directly in the head for better initialization */}
        <script src="https://sdk-cdn.mypurecloud.com/javascript/213.1.0/purecloud-platform-client-v2.min.js"></script>
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
          
          {status !== 'error' && (
            <div className="mt-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 