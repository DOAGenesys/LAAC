import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Home: Main effect - Mounting');
    setIsLoading(true);
    setError(null);

    const checkAuthenticationStatus = async () => {
      console.log('Home: checkAuthenticationStatus called.');
      try {
        if (typeof window === 'undefined') {
          console.log('Home: SSR context, check deferred to client-side.');
          return;
        }

        console.log('Home: No existing session, redirecting to SSO login.');
        router.push('/login');

      } catch (err) {
        console.error('Home: Failed to check authentication status:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during authentication check';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      checkAuthenticationStatus();
    } else {
      console.log("Home: Skipping check on server side.");
    }

  }, [router]);

  useEffect(() => {
    console.log(`Home: State Update - Loading: ${isLoading}, Error: ${error}`);
  }, [isLoading, error]);

  return (
    <>
      <Head>
        <title>LAAC - Location-Aware Access Control</title>
        <meta name="description" content="Location-Aware Access Control for Genesys Cloud" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen pt-16 pb-8 px-4">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-6">LAAC - Location-Aware Access Control</h1>
          
          {isLoading && !error && (
            <p className="mb-4">Checking authentication status...</p>
          )}

          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
              <p><strong>Error:</strong> {error}</p>
              <p className="mt-2">Please try refreshing the page or contact support if the issue persists.</p>
            </div>
          )}
          
          {isLoading && !error && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
