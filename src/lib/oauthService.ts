/**
 * Service for acquiring OAuth tokens using Client Credentials flow
 * Used in API routes for server-side operations
 */

// Internal state that holds the token cache
// Not directly exported to maintain encapsulation
let _cachedToken: string | null = null;
let _tokenExpiresAt: number = 0;

// Export functions to access and modify the internal state (primarily for testing)
export const tokenCache = {
  get cachedToken() { return _cachedToken; },
  set cachedToken(value: string | null) { _cachedToken = value; },
  get expiresAt() { return _tokenExpiresAt; },
  set expiresAt(value: number) { _tokenExpiresAt = value; },
  reset() {
    _cachedToken = null;
    _tokenExpiresAt = 0;
  }
};

// Buffer time before expiration (5 minutes)
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export async function getClientCredentialsToken(): Promise<string> {
  const currentTime = Date.now();
  
  // Validate environment variables first
  if (!process.env.NEXT_PUBLIC_GC_REGION) {
    throw new Error('Missing NEXT_PUBLIC_GC_REGION environment variable');
  }
  
  if (!process.env.GC_CC_CLIENT_ID || !process.env.GC_CC_CLIENT_SECRET) {
    throw new Error('Missing client credentials environment variables');
  }
  
  // Return cached token if it's still valid
  if (_cachedToken && _tokenExpiresAt > currentTime + EXPIRY_BUFFER_MS) {
    return _cachedToken;
  }

  try {
    // Request new token
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', process.env.GC_CC_CLIENT_ID);
    formData.append('client_secret', process.env.GC_CC_CLIENT_SECRET);

    const response = await fetch(
      `https://login.${process.env.NEXT_PUBLIC_GC_REGION}/oauth/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to obtain token: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    
    // Cache the token
    _cachedToken = data.access_token;
    
    // Set expiration time (token expiry in seconds - buffer)
    _tokenExpiresAt = currentTime + (data.expires_in * 1000);
    
    return data.access_token;
  } catch (error) {
    // Don't wrap the error if it's already an Error instance, 
    // otherwise the specific error message will be lost
    if (error instanceof Error) {
      throw error;
    }
    console.error('Error acquiring OAuth token:', error);
    throw new Error('Failed to obtain authentication token');
  }
} 