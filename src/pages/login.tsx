import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import axios from 'axios';

const Login: NextPage = () => {
  const router = useRouter();
  const { requestID, relayState } = router.query;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [enableCountrySelection, setEnableCountrySelection] = useState(false);
  const [defaultCountry, setDefaultCountry] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (relayState && typeof relayState === 'string') {
      sessionStorage.setItem('saml_relay_state', relayState);
    }
    
    const defaultCountry = process.env.NEXT_PUBLIC_LAAC_DEFAULT_COMPLIANT_COUNTRY || '';
    setSelectedCountry(defaultCountry);
    setDefaultCountry(defaultCountry);

    const fetchCountries = async () => {
      try {
        const response = await axios.get('/api/countries');
        setCountries(response.data.countries);
        if (response.data.countries.includes(defaultCountry)) {
          setSelectedCountry(defaultCountry);
        } else if (response.data.countries.length > 0) {
          setSelectedCountry(response.data.countries[0]);
          setDefaultCountry(response.data.countries[0]);
        }
      } catch (error) {
        console.error('Failed to fetch countries', error);
        setError('Could not load country list. Please try again later.');
      }
    };

    fetchCountries();
  }, [relayState]);
  
  const handleCountrySelectionToggle = (enabled: boolean) => {
    setEnableCountrySelection(enabled);
    if (!enabled) {
      // Reset to default country when disabling selection
      setSelectedCountry(defaultCountry);
    }
  };
  
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pt-20 pb-12">
      <Head>
        <title>LAAC - Sign In</title>
        <meta name="description" content="Sign in to access LAAC Identity Provider" />
      </Head>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full mix-blend-screen filter blur-xl opacity-10 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-screen filter blur-xl opacity-10 animate-float" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative container-professional">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8 animate-fadeIn">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in to access Genesys Cloud with LAAC
            </p>
          </div>

          {/* Login Form */}
          <div className="card animate-fadeIn">
            <div className="card-body">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Country Selection */}
                <div>
                  <label className="form-label">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Compliant Country
                  </label>
                  
                  <div className="mb-3">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={enableCountrySelection}
                        onChange={(e) => handleCountrySelectionToggle(e.target.checked)}
                        className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
                        Select different compliant country
                      </span>
                    </label>
                  </div>

                  {enableCountrySelection ? (
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      required
                      className="form-select"
                      disabled={countries.length === 0}
                    >
                      <option value="">Select a country...</option>
                      {countries.map((country: string) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="form-input bg-gray-50 text-gray-700 font-medium cursor-not-allowed">
                      {defaultCountry || 'Loading...'}
                    </div>
                  )}
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="form-label">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="form-input"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="form-label">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className="form-input pr-12"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Error Message */}
                {error && (
                  <div className="error-message animate-fadeIn">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <strong>Authentication Failed</strong>
                      <p className="text-sm mt-1">{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full relative"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner w-4 h-4 mr-2"></div>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign In
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};

export default Login; 
