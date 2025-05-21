/**
 * Service for acquiring OAuth tokens using Client Credentials flow
 * Used in API routes for server-side operations
 */

// Cache the token to avoid multiple requests
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

// Buffer time before expiration (5 minutes)
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export async function getClientCredentialsToken(): Promise<string> {
  const currentTime = Date.now();
  
  // Return cached token if it's still valid
  if (cachedToken && tokenExpiresAt > currentTime + EXPIRY_BUFFER_MS) {
    return cachedToken;
  }

  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_GC_REGION) {
    throw new Error('Missing NEXT_PUBLIC_GC_REGION environment variable');
  }
  
  if (!process.env.GC_CC_CLIENT_ID || !process.env.GC_CC_CLIENT_SECRET) {
    throw new Error('Missing client credentials environment variables');
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
    cachedToken = data.access_token;
    
    // Set expiration time (token expiry in seconds - buffer)
    tokenExpiresAt = currentTime + (data.expires_in * 1000);
    
    return data.access_token;
  } catch (error) {
    console.error('Error acquiring OAuth token:', error);
    throw new Error('Failed to obtain authentication token');
  }
} 