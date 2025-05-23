import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Callback() {
  const router = useRouter();
  const [status, setStatus] = useState<'redirecting' | 'error'>('redirecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log('Callback: Main effect - Mounting');
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      if (typeof window === 'undefined') {
        console.log('Callback: SSR context, processing deferred to client-side.');
        return;
      }

      if (!window.location.hash.includes('access_token=')) {
        throw new Error('No access token found in callback URL');
      }

      console.log('Callback: Access token found, redirecting to main page for LAAC processing');
      router.push('/');
      
    } catch (error) {
      console.error('Callback: Error during callback processing:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred.');
    }
  };

  return (
    <>
      <Head>
        <title>LAAC - Processing Callback</title>
        <meta name="description" content="Processing authentication callback" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          {status === 'redirecting' && (
            <>
              <h1 className="text-2xl font-semibold">Processing Authentication</h1>
              <p className="mt-4">Redirecting to LAAC process...</p>
              <div className="mt-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            </>
          )}
          
          {status === 'error' && (
            <>
              <h1 className="text-2xl font-semibold text-red-600">Callback Error</h1>
              <p className="mt-4 break-words">{errorMessage || 'An unexpected error occurred. Please try again or contact support.'}</p>
              <button 
                className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => window.location.href = '/'}
              >
                Return to Start
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}

/*
 * DEPRECATED: The following code demonstrates how to correctly leverage the Genesys Cloud JavaScript SDK in a TypeScript repository.
 * This is kept for reference but is no longer used in the current LAAC implementation, which uses HTML5 geolocation instead.
 */

// const processTokenAndSwitchDivision = async () => {
//   console.log('Callback: processTokenAndSwitchDivision called.');
//   setErrorMessage(null);

//   try {
//     if (typeof window === 'undefined') {
//       console.log('Callback: SSR context, token processing deferred to client-side.');
//       return;
//     }
    
//     console.log('Callback: Verifying Genesys SDK and extracting token...');

//     if (!window.location.hash) {
//       throw new Error('URL hash is missing, cannot extract access token.');
//     }

//     const hashParams = new URLSearchParams(window.location.hash.substring(1));
//     const accessToken = hashParams.get('access_token');

//     if (!accessToken) {
//       throw new Error('access_token not found in URL hash.');
//     }
//     console.log('Callback: Access token retrieved.');

//     await setAccessToken(accessToken);
//     console.log('Callback: Access token set in SDK.');
    
//     console.log('Callback: Fetching user details.');
//     const usersApi = await getUsersApi();
//     const meResponse = await usersApi.getUsersMe({ expand: ['geolocation'] });
//     console.log('Callback: User details fetched.', meResponse);
    
//     const userId = meResponse.id;
//     const country = meResponse.geolocation?.country || '';
//     const currentDivisionId = meResponse.division?.id || '';
//     console.log(`Callback: User ID: ${userId}, Country: ${country}, Current Division: ${currentDivisionId}`);
    
//     if (!userId) throw new Error('User ID not found in profile response.');
//     if (!currentDivisionId) {
//       throw new Error('User current division information is missing. Cannot proceed with division check.');
//     }
    
//     const env = getEnvironmentVariables();
//     console.log('Callback: Initiating division switch API call.');
//     setStatus('switching');
//     await axios.post<DivisionSwitchResponse>('/api/division-switch', {
//       userId,
//       country,
//       currentDivisionId
//     });
//     console.log('Callback: Division switch API call successful.');
    
//     setStatus('redirecting');
//     const redirectUrl = `https://apps.${env.GC_REGION}`;
//     console.log(`Callback: Redirecting to Genesys Cloud UI: ${redirectUrl}`);
//     window.location.href = redirectUrl;

//   } catch (error) {
//     console.error('Callback: Error during token processing or division switch:', error);
//     setStatus('error');
//     setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred.');
//   }
// }; 