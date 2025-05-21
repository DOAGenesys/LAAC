import { useEffect, useState } from 'react';
import Head from 'next/head';
import { initImplicitGrant } from '../lib/genesysSdk';
import { getEnvironmentVariables } from '../lib/env';

export default function Home() {
  const [envDebug, setEnvDebug] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('Home: Main effect - Mounting');
    setIsLoading(true);
    setError(null);

    // For debug display (optional)
    if (typeof window !== 'undefined') {
      const env = getEnvironmentVariables();
      setEnvDebug(`
        GC_REGION: ${env.GC_REGION ? 'SET' : 'NOT SET'}
        GC_IMPLICIT_CLIENT_ID: ${env.GC_IMPLICIT_CLIENT_ID ? 'SET' : 'NOT SET'}
      `);
    }

    const attemptLogin = async () => {
      console.log('Home: attemptLogin called.');
      try {
        if (typeof window !== 'undefined' && !window.location.hash.includes('access_token=')) {
          console.log('Home: No access token in URL, proceeding with implicit grant.');
          const callbackUrl = `${window.location.origin}/callback`;
          // initImplicitGrant now handles SDK loading and initialization internally
          await initImplicitGrant(callbackUrl);
          // If initImplicitGrant redirects, execution stops here for this page.
          // If it somehow completes without redirecting (e.g. error before redirect), handle below.
          console.log('Home: initImplicitGrant call completed. This may indicate an issue if no redirect occurred.');
        } else if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
          console.log('Home: Access token found in URL hash. This page should not process it; callback page will.');
          // Potentially redirect to a dashboard or clear hash if this is not expected.
          // For now, just stop loading as this page's primary job (redirect to login) is not needed.
          setIsLoading(false);
        } else if (typeof window === 'undefined'){
          console.log('Home: SSR context, login attempt deferred to client-side.');
          // No action needed on server, isLoading will remain true until client-side effect runs.
        }
      } catch (err) {
        console.error('Home: Failed to initialize login (initImplicitGrant failed):', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during login initialization';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
        attemptLogin();
    } else {
        console.log("Home: Skipping attemptLogin on server side.");
        // For SSR, we might want to keep isLoading true until client takes over.
        // Or, if the page isn't supposed to do anything on SSR, set isLoading to false.
        // Given it redirects, client-side action is key.
    }

    // No cleanup needed as initImplicitGrant handles its own lifecycle or redirects.
  }, []); // Runs once on mount

  // Optional: Log state changes for debugging
  useEffect(() => {
    console.log(`Home: State Update - Loading: ${isLoading}, Error: ${error}`);
  }, [isLoading, error]);

  return (
    <>
      <Head>
        <title>LAAC - Genesys Cloud Login</title>
        <meta name="description" content="Redirecting to Genesys Cloud for authentication" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        {/* The SDK script tag is now managed by genesysSdk.ts */}
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">LAAC - Redirecting to Login</h1>
          
          {isLoading && !error && (
            <p className="mt-4">Please wait while we prepare the login page...</p>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
              <p><strong>Login Error:</strong> {error}</p>
              <p className="mt-2">Please try refreshing the page or contact support if the issue persists.</p>
            </div>
          )}
          
          {isLoading && !error && (
            <div className="mt-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-gray-100 rounded text-left text-sm">
              <h2 className="font-semibold">Debug Info (Home Page):</h2>
              <pre className="text-xs mt-2 whitespace-pre-wrap">{envDebug}</pre>
              <p className="text-xs mt-1">Current Status: {isLoading ? 'Loading/Initializing...' : (error ? 'Error' : 'Idle/Redirected')}</p>
              {error && <p className="text-xs mt-1 text-red-600">Error Details: {error}</p>}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
