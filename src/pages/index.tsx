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

        // Check if user has an existing valid auth token
        const authCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth_token='));

        if (authCookie) {
          console.log('Home: Found existing auth token, verifying...');
          
          // Check if user has completed LAAC in this session
          const flowStateRaw = sessionStorage.getItem('laac_flow_state');
          if (flowStateRaw) {
            try {
              const flowState = JSON.parse(flowStateRaw);
              if (flowState.laacCompleted) {
                console.log('Home: User has completed LAAC, redirecting to complete SSO');
                const relayState = sessionStorage.getItem('saml_relay_state');
                const redirectUrl = relayState ? `/api/saml/sso?RelayState=${encodeURIComponent(relayState)}` : '/api/saml/sso';
                window.location.href = redirectUrl;
                return;
              } else if (flowState.loginCompleted && !flowState.laacCompleted) {
                console.log('Home: User logged in but LAAC not completed, redirecting to LAAC');
                router.push('/laac');
                return;
              }
            } catch (e) {
              console.log('Home: Invalid flow state, clearing and proceeding with fresh login');
              sessionStorage.removeItem('laac_flow_state');
              sessionStorage.removeItem('user_email');
            }
          }

          console.log('Home: Valid auth token but no valid flow state, starting fresh login process');
        } else {
          console.log('Home: No auth token found');
        }

        console.log('Home: Starting fresh authentication process, redirecting to SSO login.');
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
