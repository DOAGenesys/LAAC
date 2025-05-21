import { useEffect, useState } from 'react';
import Head from 'next/head';
import { initImplicitGrant } from '../lib/genesysSdk';
import { getEnvironmentVariables } from '../lib/env';

export default function Home() {
  const [envDebug, setEnvDebug] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sdkReady, setSdkReady] = useState<boolean>(false);

  useEffect(() => {
    console.log('Home component mounted');

    // Function to initialize login process
    const attemptLogin = async () => {
      console.log('Attempting login...');
      setIsLoading(true);
      setError(null);
      try {
        if (typeof window !== 'undefined' && !window.location.hash.includes('access_token=')) {
          console.log('No access token in URL, proceeding with implicit grant');
          const callbackUrl = `${window.location.origin}/callback`;
          await initImplicitGrant(callbackUrl);
          // initImplicitGrant will redirect, so no need to setIsLoading(false) here
        } else if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
          console.log('Access token found in URL, likely on callback or already logged in. Redirecting to callback or main app.');
          // This case should ideally be handled by the callback page or if the user revisits the root.
          // For simplicity, we'll let the callback page handle it.
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize login:', err);
        setError(err instanceof Error ? err.message : 'Unknown error during login initialization');
        setIsLoading(false);
      }
    };

    // Function to load and initialize the Genesys SDK
    const loadAndInitSdk = () => {
      console.log('loadAndInitSdk called');
      if (typeof window === 'undefined') {
        console.log('Window is undefined, skipping SDK load (SSR)');
        return;
      }

      const env = getEnvironmentVariables();
      setEnvDebug(`
        GC_REGION: ${env.GC_REGION ? 'SET' : 'NOT SET'}
        GC_IMPLICIT_CLIENT_ID: ${env.GC_IMPLICIT_CLIENT_ID ? 'SET' : 'NOT SET'}
      `);

      // Check if platformClient is already on window (e.g., script loaded via <Head>)
      if ((window as any).platformClient) {
        console.log('platformClient already exists on window. Initializing login.');
        setSdkReady(true);
        attemptLogin();
        return;
      }

      // If not, try to load it dynamically
      let script = document.getElementById('genesys-platform-client-sdk') as HTMLScriptElement;
      if (!script) {
        console.log('Genesys Platform Client SDK script not found, creating and appending...');
        script = document.createElement('script');
        script.id = 'genesys-platform-client-sdk';
        script.src = 'https://sdk-cdn.mypurecloud.com/javascript/213.1.0/purecloud-platform-client-v2.min.js';
        // script.async = false; // async=false is generally not recommended for modern dev, ensure it loads before use

        script.onload = () => {
          console.log('Genesys Platform Client SDK SCRIPT LOADED (onload event)');
          if ((window as any).platformClient) {
            console.log('platformClient IS NOW AVAILABLE on window after onload. Initializing login.');
            setSdkReady(true);
            attemptLogin();
          } else {
            console.error('platformClient STILL NOT AVAILABLE on window after onload event.');
            setError('Genesys SDK loaded but platformClient global object not found. This is unexpected.');
            setIsLoading(false);
          }
        };

        script.onerror = (event: Event | string) => {
          console.error('Failed to load Genesys Platform Client SDK SCRIPT:', event);
          setError('Failed to load Genesys SDK script. Check network and console for details.');
          setIsLoading(false);
        };
        document.head.appendChild(script);
        console.log('Genesys SDK script appended to head.');
      } else {
        console.log('Genesys SDK script element already exists in DOM. Waiting for it to potentially load or re-checking.');
        // If script tag exists but platformClient isn't on window yet, it might be loading
        // or an error occurred. The onload/onerror of that existing tag should handle it.
        // For safety, we can add a timeout check.
        setTimeout(() => {
          if ((window as any).platformClient) {
            console.log('platformClient became available after a short delay.');
            setSdkReady(true);
            attemptLogin();
          } else if (!error && isLoading) { // only set error if no other error occurred and still loading
            console.error('platformClient still not available after delay, script tag existed.');
            // setError('Genesys SDK script was present but failed to initialize platformClient globally.');
            // setIsLoading(false); 
            // Avoid setting error here if onload/onerror of the original script might still fire
          }
        }, 500); // Check after 500ms
      }
    };

    loadAndInitSdk();

  }, []); // Empty dependency array ensures this runs once on mount

  // Debug logs for state changes
  useEffect(() => {
    console.log(`SDK Ready State: ${sdkReady}, Loading State: ${isLoading}, Error State: ${error}`);
  }, [sdkReady, isLoading, error]);

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
              <p className="text-xs mt-2">SDK Ready: {sdkReady ? 'Yes' : 'No'}</p>
              <p className="text-xs mt-2">Current Error: {error || 'None'}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
