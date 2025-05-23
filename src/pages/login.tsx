import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { initImplicitGrant } from '../lib/genesysSdk';

const Login: NextPage = () => {
  const router = useRouter();
  const { requestID, relayState } = router.query;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useSSO, setUseSSO] = useState(false);

  useEffect(() => {
    if (relayState && typeof relayState === 'string') {
      sessionStorage.setItem('saml_relay_state', relayState);
    }
  }, [relayState]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      console.log('Login: IdP authentication successful, initiating OAuth flow');
      await initiateOAuthFlow();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initiateOAuthFlow = async () => {
    try {
      console.log('Login: Starting OAuth implicit grant flow');
      const callbackUrl = `${window.location.origin}/laac`;
      await initImplicitGrant(callbackUrl);
    } catch (err) {
      console.error('Login: Failed to initiate OAuth flow:', err);
      setError('Failed to initiate OAuth flow');
    }
  };

  const handleSSOLogin = () => {
    setUseSSO(true);
    setLoading(true);
    initiateOAuthFlow();
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>LAAC SSO - Identity Provider - Login</title>
      </Head>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            LAAC Identity Provider
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access Genesys Cloud
          </p>
        </div>

        {!useSSO ? (
          <>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <input type="hidden" name="remember" defaultValue="true" />
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="email-address" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              
              {error && (
                <div className="text-red-500 text-sm text-center">
                  {error}
                </div>
              )}
              
              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign in with IdP'}
                </button>
                
                <div className="text-center">
                  <span className="text-gray-500">or</span>
                </div>
                
                <button
                  type="button"
                  onClick={handleSSOLogin}
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  Sign in with Genesys Cloud SSO
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center">
            <p className="text-lg">Redirecting to Genesys Cloud SSO...</p>
            <div className="mt-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login; 