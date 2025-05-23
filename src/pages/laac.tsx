import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';

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

export default function LAAC() {
  const router = useRouter();
  const [status, setStatus] = useState<'initializing' | 'geolocation' | 'geocoding' | 'user_search' | 'division_switch' | 'completing_sso' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    geolocation?: GeolocationPosition;
    country?: string;
    user?: UserSearchResult;
    email?: string;
  }>({});

  useEffect(() => {
    console.log('LAAC: Component mounted');
    validateFlowStateAndProcess();
  }, []);

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

      console.log('LAAC: Flow state validation passed, proceeding with LAAC process');
      console.log('LAAC: Flow session ID:', flowState.sessionId);
      
      // Proceed with LAAC process
      await processLAAC();

    } catch (error) {
      console.error('LAAC: Error during flow validation:', error);
      sessionStorage.removeItem('laac_flow_state');
      sessionStorage.removeItem('user_email');
      router.push('/');
    }
  };

  const processLAAC = async () => {
    try {
      const geolocationResult = await performGeolocationCheck();
      const countryResult = geolocationResult.country;
      const userResult = await performUserSearch();
      await performDivisionSwitch(userResult, countryResult);
      await completeSSOFlow();

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

  const performDivisionSwitch = async (user: UserSearchResult, country: string): Promise<void> => {
    console.log('LAAC: Starting division switch');
    setStatus('division_switch');

    if (!user || !country) {
      throw new Error('Missing user or country information for division switch');
    }

    try {
      await axios.post('/api/division-switch', {
        userId: user.userId,
        country: country,
        currentDivisionId: user.currentDivisionId
      });

      console.log('LAAC: Division switch completed');

    } catch (error) {
      console.error('LAAC: Division switch failed:', error);
      throw new Error('Failed to update user division assignment');
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

  return (
    <>
      <Head>
        <title>LAAC - Location-Aware Access Control</title>
        <meta name="description" content="Processing location-aware access control" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen pt-16 pb-8 px-4">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-6">Location-Aware Access Control</h1>
          
          {status !== 'error' && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
              
              <p className="text-lg mb-4">{getStatusMessage()}</p>
              
              <div className="mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              </div>

              {progress.geolocation && (
                <div className="mb-2 text-sm text-gray-600">
                  <p>✓ Location detected</p>
                </div>
              )}
              
              {progress.country && (
                <div className="mb-2 text-sm text-gray-600">
                  <p>✓ Country: {progress.country}</p>
                </div>
              )}
              
              {progress.user && (
                <div className="mb-2 text-sm text-gray-600">
                  <p>✓ User profile located</p>
                </div>
              )}
            </>
          )}

          {status === 'error' && (
            <>
              <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
                <p><strong>LAAC Process Error:</strong></p>
                <p className="mt-2">{errorMessage}</p>
              </div>
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => window.location.href = '/'}
              >
                Return to Start
              </button>
            </>
          )}

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-gray-100 rounded text-left text-xs">
              <h2 className="font-semibold mb-2">Debug Info (LAAC Page):</h2>
              <p>Status: {status}</p>
              <p>Progress: {JSON.stringify(progress, null, 2)}</p>
              {errorMessage && <p className="text-red-600">Error: {errorMessage}</p>}
            </div>
          )}
        </div>
      </main>
    </>
  );
} 