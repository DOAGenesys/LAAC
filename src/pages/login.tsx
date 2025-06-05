import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { COUNTRIES } from '../lib/countries';

const Login: NextPage = () => {
  const router = useRouter();
  const { requestID, relayState } = router.query;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (relayState && typeof relayState === 'string') {
      sessionStorage.setItem('saml_relay_state', relayState);
    }
    
    const defaultCountry = process.env.NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY || '';
    setSelectedCountry(defaultCountry);
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

      console.log('Login: IdP authentication successful, storing user email and flow state, redirecting to LAAC process');
      
      // Generate a unique flow session ID to prevent bypassing LAAC
      const flowSessionId = crypto.randomUUID();
      const flowState = {
        sessionId: flowSessionId,
        email: email,
        selectedCountry: selectedCountry,
        loginCompleted: true,
        laacCompleted: false,
        timestamp: Date.now()
      };
      
      // Store flow state in sessionStorage for LAAC process validation
      sessionStorage.setItem('user_email', email);
      sessionStorage.setItem('laac_flow_state', JSON.stringify(flowState));
      
      console.log('Login: Flow state created with session ID:', flowSessionId);
      
      router.push('/laac');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>LAAC SSO - Identity Provider - Login</title>
      </Head>
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            LAAC Identity Provider
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access Genesys Cloud
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" defaultValue="true" />
          
          <div className="mb-6">
            <label htmlFor="country-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select Compliant Country
            </label>
            <select
              id="country-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            >
              <option value="">Select a country...</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

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
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login; 
