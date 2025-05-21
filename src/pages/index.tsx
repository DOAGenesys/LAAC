import { useEffect, useState } from 'react';
import Head from 'next/head';
import { initImplicitGrant, getPlatformClient } from '../lib/genesysSdk';
import { getEnvironmentVariables } from '../lib/env';

export default function Home() {
  const [envDebug, setEnvDebug] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Debug check for environment variables
    if (typeof window !== 'undefined') {
      const env = getEnvironmentVariables();
      setEnvDebug(`
        GC_REGION: ${env.GC_REGION ? 'SET' : 'NOT SET'}
        GC_IMPLICIT_CLIENT_ID: ${env.GC_IMPLICIT_CLIENT_ID ? 'SET' : 'NOT SET'}
      `);
      
      // Add script tag to load the Genesys SDK
      if (!document.getElementById('genesys-sdk')) {
        const script = document.createElement('script');
        script.id = 'genesys-sdk';
        script.src = 'https://sdk-cdn.mypurecloud.com/javascript/221.0.0/purecloud-platform-client-v2.min.js';
        script.async = true;
        script.onload = () => {
          // Check if platformClient is available globally after script loads
          const client = getPlatformClient();
          if (client) {
            console.log('Genesys SDK loaded successfully');
            initLogin();
          } else {
            setError('Genesys SDK loaded but platformClient is not available');
            setIsLoading(false);
          }
        };
        script.onerror = (e) => {
          console.error('Failed to load Genesys SDK', e);
          setError('Failed to load Genesys SDK. Please check your connection and try again.');
          setIsLoading(false);
        };
        document.body.appendChild(script);
      } else {
        // SDK script tag already exists
        const client = getPlatformClient();
        if (client) {
          initLogin();
        } else {
          // Script exists but may not be loaded yet, wait a bit
          const checkInterval = setInterval(() => {
            const client = getPlatformClient();
            if (client) {
              clearInterval(checkInterval);
              initLogin();
            }
          }, 100);
          
          // Set a timeout to clear the interval if it runs too long
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!getPlatformClient()) {
              setError('Timed out waiting for Genesys SDK to load');
              setIsLoading(false);
            }
          }, 5000);
        }
      }
    }
  }, []);

  // Initialize the login process
  const initLogin = async () => {
    try {
      // Check if there's no access_token in the URL (which would indicate we're not on the callback)
      if (!window.location.hash.includes('access_token=')) {
        // Start the login process by initializing the implicit grant flow
        const callbackUrl = `${window.location.origin}/callback`;
        await initImplicitGrant(callbackUrl);
      }
    } catch (err) {
      console.error('Failed to initialize login:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>LAAC - Genesys Cloud Division Assignment</title>
        <meta name="description" content="Automatic division assignment based on user location" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">LAAC - Redirecting to Login</h1>
          <p className="mt-4">Please wait while we redirect you to the Genesys Cloud login...</p>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}
          
          {isLoading && !error && (
            <div className="mt-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-gray-100 rounded text-left">
              <h2 className="font-semibold">Debug Info:</h2>
              <pre className="text-xs mt-2">{envDebug}</pre>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
