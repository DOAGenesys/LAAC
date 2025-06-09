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
      
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 pt-20 pb-12">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-40 left-1/2 transform -translate-x-1/2 w-80 h-80 bg-cyan-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative container-professional">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12 animate-fadeIn">
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2 text-balance">
                      <span className="text-gradient-primary">LAAC</span>
                    </h1>
                    <p className="text-xl lg:text-2xl text-gray-600 font-light">
                      Location-Aware Access Control
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 text-balance">
                Secure access management for Genesys Cloud with intelligent location-based authentication and compliance controls.
              </p>

              {/* Features Grid */}
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="card group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="card-body text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors duration-300">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Authentication</h3>
                    <p className="text-gray-600 text-sm">Multi-layered security with location-based verification</p>
                  </div>
                </div>

                <div className="card group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="card-body text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors duration-300">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Compliance Ready</h3>
                    <p className="text-gray-600 text-sm">Automated compliance management for global regulations</p>
                  </div>
                </div>

                <div className="card group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="card-body text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 transition-colors duration-300">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Processing</h3>
                    <p className="text-gray-600 text-sm">Instant location verification and access decisions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="max-w-md mx-auto">
              <div className="card animate-fadeIn">
                <div className="card-body text-center">
                  {isLoading && !error && (
                    <>
                      <div className="flex items-center justify-center mb-4">
                        <div className="loading-spinner w-8 h-8"></div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Initializing Authentication</h3>
                      <p className="text-gray-600 mb-6">
                        Checking your authentication status and preparing secure access...
                      </p>
                      <div className="progress-bar">
                        <div className="progress-fill animate-pulse" style={{ width: '60%' }}></div>
                      </div>
                    </>
                  )}

                  {error && (
                    <>
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-red-900 mb-2">Authentication Error</h3>
                      <div className="error-message mb-4">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <strong>Error:</strong> {error}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        Please try refreshing the page or contact support if the issue persists.
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* System Status */}
              <div className="mt-8 text-center">
                <div className="inline-flex items-center space-x-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>System Status: Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
