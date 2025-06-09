import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { getCountries } from '../lib/divisionService';

interface GeolocationPosition {
  latitude: number;
  longitude: number;
}

interface GeocodeResponse {
  address: {
    country: string;
    country_code: string;
  };
}

interface UserSearchResult {
  userId: string;
  currentDivisionId: string;
}

interface CalculationResults {
  detectedCountry: string;
  selectedCountry: string;
  isCompliant: boolean;
  targetDivision: 'compliant' | 'non-compliant';
}

export default function LAAC() {
  const router = useRouter();
  const [status, setStatus] = useState<'initializing' | 'geolocation' | 'geocoding' | 'user_search' | 'division_switch' | 'calculations_complete' | 'completing_sso' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    geolocation?: GeolocationPosition;
    country?: string;
    user?: UserSearchResult;
    email?: string;
  }>({});
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [calculationResults, setCalculationResults] = useState<CalculationResults | null>(null);
  const [targetDivisionNames, setTargetDivisionNames] = useState<string[]>([]);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [enableCountryOverride, setEnableCountryOverride] = useState(false);
  const [supportedCountries, setSupportedCountries] = useState<string[]>([]);

  useEffect(() => {
    console.log('LAAC: Component mounted');
    validateFlowStateAndProcess();

    const fetchCountries = async () => {
      try {
        const response = await axios.get('/api/countries');
        setCountries([...response.data.countries, 'Other']);
        setSupportedCountries(response.data.countries);
      } catch (error) {
        console.error('Failed to fetch countries', error);
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    const fetchDivisionNames = async () => {
      if (calculationResults) {
        setIsLoadingDivisions(true);
        setTargetDivisionNames([]);
        try {
          const response = await axios.post('/api/divisions/names', {
            selectedCountry: calculationResults.selectedCountry,
            detectedCountry: calculationResults.detectedCountry
          });
          if (response.data.names) {
            setTargetDivisionNames(response.data.names);
          }
        } catch (error) {
          console.error('Failed to fetch division names', error);
          setTargetDivisionNames(['Error loading division names']);
        } finally {
          setIsLoadingDivisions(false);
        }
      }
    };

    fetchDivisionNames();
  }, [calculationResults]);

  const validateFlowStateAndProcess = async () => {
    console.log('LAAC: Validating flow state before processing');
    
    try {
      // Check if user has valid flow state from login
      const flowStateRaw = sessionStorage.getItem('laac_flow_state');
      if (!flowStateRaw) {
        console.error('LAAC: No flow state found - user may have bypassed login');
        router.push('/');
        return;
      }

      let flowState;
      try {
        flowState = JSON.parse(flowStateRaw);
      } catch (e) {
        console.error('LAAC: Invalid flow state format');
        sessionStorage.removeItem('laac_flow_state');
        router.push('/');
        return;
      }

      // Validate flow state structure and timing
      if (!flowState.sessionId || !flowState.email || !flowState.loginCompleted || flowState.laacCompleted) {
        console.error('LAAC: Invalid flow state - missing required fields or LAAC already completed');
        sessionStorage.removeItem('laac_flow_state');
        router.push('/');
        return;
      }

      // Check flow state is not too old (15 minutes max)
      const flowAge = Date.now() - flowState.timestamp;
      if (flowAge > 15 * 60 * 1000) {
        console.error('LAAC: Flow state expired - user must re-authenticate');
        sessionStorage.removeItem('laac_flow_state');
        sessionStorage.removeItem('user_email');
        router.push('/');
        return;
      }

      // Verify user email matches flow state
      const sessionEmail = sessionStorage.getItem('user_email');
      if (sessionEmail !== flowState.email) {
        console.error('LAAC: Email mismatch in flow state');
        sessionStorage.removeItem('laac_flow_state');
        sessionStorage.removeItem('user_email');
        router.push('/');
        return;
      }

      // Set selected country from flow state
      const countryFromFlow = flowState.selectedCountry || process.env.NEXT_PUBLIC_LAAC_DEFAULT_COMPLIANT_COUNTRY || '';
      setSelectedCountry(countryFromFlow);

      console.log('LAAC: Flow state validation passed, proceeding with LAAC process');
      console.log('LAAC: Flow session ID:', flowState.sessionId);
      console.log('LAAC: Selected country from login:', countryFromFlow);
      
      // Proceed with LAAC process with the country from flow
      await processLAAC(countryFromFlow);

    } catch (error) {
      console.error('LAAC: Error during flow validation:', error);
      sessionStorage.removeItem('laac_flow_state');
      sessionStorage.removeItem('user_email');
      router.push('/');
    }
  };

  const processLAAC = async (countryFromFlow?: string) => {
    try {
      const geolocationResult = await performGeolocationCheck();
      const countryResult = geolocationResult.country;
      const userResult = await performUserSearch();
      
      const selectedCountryToUse = countryFromFlow || selectedCountry;
      const isCompliant = countryResult === selectedCountryToUse;
      const targetDivision = isCompliant ? 'compliant' : 'non-compliant';
      
      setCalculationResults({
        detectedCountry: countryResult,
        selectedCountry: selectedCountryToUse,
        isCompliant: isCompliant,
        targetDivision: targetDivision
      });
      
      setStatus('calculations_complete');

    } catch (error) {
      console.error('LAAC: Error during LAAC process:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred during LAAC process');
    }
  };

  const performGeolocationCheck = async (): Promise<{ country: string }> => {
    console.log('LAAC: Starting geolocation check');
    setStatus('geolocation');

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('LAAC: Geolocation obtained', position.coords);
          const geolocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          setProgress(prev => ({ ...prev, geolocation }));
          
          try {
            const country = await performGeocoding(geolocation);
            setProgress(prev => ({ ...prev, country }));
            resolve({ country });
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          console.log('LAAC: Geolocation permission denied or failed, user will be considered non-compliant');
          const country = 'UNKNOWN';
          setProgress(prev => ({ ...prev, country }));
          resolve({ country });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  const performGeocoding = async (geolocation: GeolocationPosition): Promise<string> => {
    console.log('LAAC: Starting geocoding');
    setStatus('geocoding');

    try {
      const response = await axios.post('/api/geocode', {
        latitude: geolocation.latitude,
        longitude: geolocation.longitude
      });

      if (!response.data.success) {
        console.error('LAAC: Geocoding failed:', response.data.error);
        return 'UNKNOWN';
      }

      const country = response.data.country || 'UNKNOWN';
      
      console.log('LAAC: Country determined:', country);
      return country;

    } catch (error) {
      console.error('LAAC: Geocoding failed:', error);
      return 'UNKNOWN';
    }
  };

  const performUserSearch = async (): Promise<UserSearchResult> => {
    console.log('LAAC: Starting user search');
    setStatus('user_search');

    const userEmail = getUserEmailFromSession();
    if (!userEmail) {
      throw new Error('User email not available from session');
    }

    setProgress(prev => ({ ...prev, email: userEmail }));

    try {
      const response = await axios.post('/api/users/search', {
        email: userEmail
      });

      const userData = response.data;
      if (!userData.userId) {
        throw new Error('User not found in Genesys Cloud');
      }

      console.log('LAAC: User found:', userData);
      setProgress(prev => ({ ...prev, user: userData }));
      
      return userData;

    } catch (error) {
      console.error('LAAC: User search failed:', error);
      throw new Error('Failed to find user in Genesys Cloud');
    }
  };

  const getUserEmailFromSession = (): string | null => {
    // Read user email from sessionStorage (stored during login)
    const userEmail = sessionStorage.getItem('user_email');
    
    if (!userEmail) {
      console.error('LAAC: User email not found in sessionStorage');
      return null;
    }
    
    console.log('LAAC: User email retrieved from sessionStorage:', userEmail);
    return userEmail;
  };

  const performDivisionSwitch = async (user: UserSearchResult, country: string, detectedCountry: string): Promise<void> => {
    console.log('LAAC: Starting division switch');
    setStatus('division_switch');

    if (!user || !country) {
      throw new Error('Missing user or country information for division switch');
    }

    try {
      await axios.post('/api/division-switch', {
        userId: user.userId,
        country: country,
        currentDivisionId: user.currentDivisionId,
        detectedCountry: detectedCountry
      });

      console.log('LAAC: Division switch completed');

    } catch (error) {
      console.error('LAAC: Division switch failed:', error);
      throw new Error('Failed to update user division assignment');
    }
  };

  const proceedWithCompletion = async () => {
    try {
      if (!calculationResults || !progress.user) {
        throw new Error('Missing calculation results or user data');
      }

      await performDivisionSwitch(progress.user, calculationResults.selectedCountry, calculationResults.detectedCountry);
      await completeSSOFlow();

    } catch (error) {
      console.error('LAAC: Error during completion:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred during completion');
    }
  };

  const completeSSOFlow = async (): Promise<void> => {
    console.log('LAAC: Completing SSO flow');
    setStatus('completing_sso');

    try {
      // Mark LAAC as completed in flow state
      const flowStateRaw = sessionStorage.getItem('laac_flow_state');
      if (flowStateRaw) {
        const flowState = JSON.parse(flowStateRaw);
        flowState.laacCompleted = true;
        flowState.completionTimestamp = Date.now();
        sessionStorage.setItem('laac_flow_state', JSON.stringify(flowState));
        console.log('LAAC: Marked LAAC as completed in flow state');
      }

      const relayState = sessionStorage.getItem('saml_relay_state');
      const redirectUrl = relayState ? `/api/saml/sso?RelayState=${encodeURIComponent(relayState)}` : '/api/saml/sso';
      
      console.log('LAAC: Redirecting to complete SAML SSO:', redirectUrl);
      window.location.href = redirectUrl;
      
    } catch (error) {
      console.error('LAAC: Error during SSO completion:', error);
      throw error;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return 'Initializing LAAC process...';
      case 'geolocation':
        return 'Checking your location...';
      case 'geocoding':
        return 'Determining your country...';
      case 'user_search':
        return 'Locating your user profile...';
      case 'calculations_complete':
        return 'Calculations complete - Review and proceed';
      case 'division_switch':
        return 'Updating division assignment...';
      case 'completing_sso':
        return 'Completing login process...';
      case 'error':
        return 'Error occurred during process';
      default:
        return 'Processing...';
    }
  };

  const getProgressPercentage = () => {
    switch (status) {
      case 'initializing':
        return 10;
      case 'geolocation':
        return 25;
      case 'geocoding':
        return 40;
      case 'user_search':
        return 60;
      case 'calculations_complete':
        return 70;
      case 'division_switch':
        return 80;
      case 'completing_sso':
        return 95;
      case 'error':
        return 0;
      default:
        return 0;
    }
  };

  const handleCountryOverride = (newCountry: string) => {
    if (calculationResults) {
      const newIsCompliant = newCountry === calculationResults.selectedCountry;
      const newTargetDivision = newIsCompliant ? 'compliant' : 'non-compliant';

      setCalculationResults({
        ...calculationResults,
        detectedCountry: newCountry,
        isCompliant: newIsCompliant,
        targetDivision: newTargetDivision
      });
    }
  };

  const getComplianceStatusText = () => {
    if (!calculationResults) return 'Unknown';
    
    const isMatch = calculationResults.selectedCountry === calculationResults.detectedCountry;
    const isDetectedCountrySupported = supportedCountries.includes(calculationResults.detectedCountry);
    
    if (isMatch && isDetectedCountrySupported) {
      // Both match and detected country is supported
      return 'Compliant';
    } else if (!isMatch && isDetectedCountrySupported) {
      // Countries don't match but detected country is supported
      return 'Non-Compliant';
    } else {
      // Detected country is not supported (like "Other")
      return 'Out of scope';
    }
  };

  const handleOverrideToggle = (enabled: boolean) => {
    setEnableCountryOverride(enabled);
    if (calculationResults) {
      if (!enabled) {
        // Reset to original detected country when disabling override
        const originalCountry = progress.country || 'UNKNOWN';
        handleCountryOverride(originalCountry);
      } else {
        // When enabling, set to the first supported country (which would be the dropdown default)
        // This ensures the calculation matches what's visually selected in the dropdown
        let defaultCountry = calculationResults.detectedCountry;
        
        // If the current detected country is not in the dropdown options, use the first supported country
        if (countries.length > 0) {
          const availableCountries = [...countries];
          // If current detected country is UNKNOWN and not in the list, don't include it as default
          if (calculationResults.detectedCountry === 'UNKNOWN' && !countries.includes('UNKNOWN')) {
            defaultCountry = availableCountries[0];
          } else if (!availableCountries.includes(calculationResults.detectedCountry)) {
            defaultCountry = availableCountries[0];
          }
        }
        
        handleCountryOverride(defaultCountry);
      }
    }
  };

  return (
    <>
      <Head>
        <title>LAAC - Location Verification</title>
        <meta name="description" content="Processing location-aware access control" />
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
            {/* Header */}
            <div className="text-center mb-8 animate-fadeIn">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                Location Verification
              </h1>
              <p className="text-lg text-gray-600">
                Processing your location for compliance validation
              </p>
            </div>
            
            {status !== 'error' && (
              <div className="max-w-2xl mx-auto">
                {/* Progress Section */}
                <div className="card mb-8 animate-fadeIn">
                  <div className="card-body">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Processing Status</h3>
                      <span className="text-sm font-medium text-blue-600">{getProgressPercentage()}%</span>
                    </div>
                    
                    <div className="progress-bar mb-6">
                      <div 
                        className="progress-fill"
                        style={{ width: `${getProgressPercentage()}%` }}
                      ></div>
                    </div>
                    
                    <div className="text-center mb-6">
                      <p className="text-lg font-medium text-gray-900 mb-2">{getStatusMessage()}</p>
                      
                      {status !== 'calculations_complete' && (
                        <div className="flex items-center justify-center">
                          <div className="loading-spinner w-6 h-6 mr-2"></div>
                          <span className="text-sm text-gray-600">Please wait...</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Steps */}
                    <div className="space-y-3">
                      <div className={`flex items-center space-x-3 ${progress.geolocation ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${progress.geolocation ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {progress.geolocation ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className="text-sm font-medium">Location Detection</span>
                      </div>
                      
                      <div className={`flex items-center space-x-3 ${progress.country ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${progress.country ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {progress.country ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          Country Identification {progress.country && `(${progress.country})`}
                        </span>
                      </div>
                      
                      <div className={`flex items-center space-x-3 ${progress.user ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${progress.user ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {progress.user ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <span className="text-sm font-medium">User Profile Lookup</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results Section */}
                {status === 'calculations_complete' && calculationResults && (
                  <div className="card animate-fadeIn">
                    <div className="card-header">
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Verification Complete
                      </h2>
                    </div>
                                         <div className="card-body">
                       {/* Location Information */}
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                         <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                          <div className="flex items-center mb-2">
                            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm font-medium text-gray-500">Selected Compliant Country</p>
                          </div>
                          <p className="text-xl font-bold text-gray-900">{calculationResults.selectedCountry}</p>
                        </div>
                        
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                          <div className="flex items-center mb-2">
                            <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm font-medium text-gray-500">Detected Geolocation Country</p>
                          </div>
                          
                          <div className="mt-3 mb-4">
                            <label className="flex items-center cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={enableCountryOverride}
                                onChange={(e) => handleOverrideToggle(e.target.checked)}
                                className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
                                Enable manual override for testing
                              </span>
                            </label>
                          </div>

                          {enableCountryOverride ? (
                            <select
                              value={calculationResults.detectedCountry}
                              onChange={(e) => handleCountryOverride(e.target.value)}
                              className="form-select text-xl font-bold"
                            >
                              {calculationResults.detectedCountry === 'UNKNOWN' && !countries.includes('UNKNOWN') && (
                                <option key="unknown" value="UNKNOWN">
                                  UNKNOWN
                                </option>
                              )}
                              {countries.map((country) => (
                                <option key={country} value={country}>
                                  {country}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-xl font-bold text-gray-900">{calculationResults.detectedCountry}</p>
                          )}
                          
                          {enableCountryOverride && (
                            <p className="text-xs text-gray-500 mt-2 italic">
                              For testing purposes only - you can manually override the detected country.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Compliance Status */}
                      <div className={`p-6 rounded-xl border-2 mb-8 ${
                        calculationResults.isCompliant 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-center mb-4">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                            calculationResults.isCompliant 
                              ? 'bg-green-100' 
                              : 'bg-red-100'
                          }`}>
                            {calculationResults.isCompliant ? (
                              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-medium mb-2 ${
                            calculationResults.isCompliant ? 'text-green-700' : 'text-red-700'
                          }`}>
                            Compliance Status
                          </p>
                          <p className={`text-3xl font-bold ${
                            calculationResults.isCompliant ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {getComplianceStatusText()}
                          </p>
                        </div>
                      </div>

                      {/* Division Assignment */}
                      <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mb-8">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-700">Target Division Assignment</p>
                            <p className="text-xs text-blue-600">Your organizational division will be updated</p>
                          </div>
                        </div>
                        {isLoadingDivisions ? (
                          <div className="flex items-center">
                            <div className="loading-spinner w-4 h-4 mr-2"></div>
                            <span className="text-lg font-semibold text-blue-900">Loading division information...</span>
                          </div>
                        ) : (
                          <div className="text-lg font-bold text-blue-900">
                            {targetDivisionNames.length > 0 ? (
                              targetDivisionNames.map((name, index) => (
                                <div key={index} className="bg-white px-4 py-2 rounded-lg border border-blue-200 mb-2 last:mb-0">
                                  {name}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500 italic">No division assignment available</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Instructions */}
                      <div className="info-message mb-8">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm">
                          <strong>Next Steps</strong>
                          <p className="mt-1">Your organizational division will be automatically updated based on these verification results before you are redirected to Genesys Cloud.</p>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={proceedWithCompletion}
                        className="btn btn-primary w-full text-lg py-4"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        Proceed to Genesys Cloud
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="max-w-2xl mx-auto">
                <div className="card animate-fadeIn">
                  <div className="card-body text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-red-900 mb-4">Verification Failed</h2>
                    <div className="error-message mb-6">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <strong>LAAC Process Error</strong>
                        <p className="text-sm mt-1">{errorMessage}</p>
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => window.location.href = '/'}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Return to Home
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="max-w-2xl mx-auto mt-8">
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Debug Information</h3>
                  </div>
                  <div className="card-body">
                    <div className="text-sm font-mono text-gray-600 space-y-2">
                      <div><strong>Status:</strong> {status}</div>
                      <div><strong>Progress:</strong></div>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(progress, null, 2)}
                      </pre>
                      {errorMessage && (
                        <div className="text-red-600">
                          <strong>Error:</strong> {errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
} 
