import { useEffect } from 'react';
import Head from 'next/head';
import { initImplicitGrant } from '../lib/genesysSdk';

export default function Home() {
  useEffect(() => {
    // Check if there's no access_token in the URL (which would indicate we're not on the callback)
    if (typeof window !== 'undefined' && !window.location.hash.includes('access_token=')) {
      // Start the login process by initializing the implicit grant flow
      const callbackUrl = `${window.location.origin}/callback`;
      initImplicitGrant(callbackUrl);
    }
  }, []);

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
          <div className="mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      </main>
    </>
  );
}
