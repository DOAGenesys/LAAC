/**
 * HTTP Client Utility
 * 
 * Provides a clean interface for making HTTP requests that ensures
 * no infrastructure headers (Vercel, etc.) are accidentally forwarded
 * to external APIs.
 */

interface CleanFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | FormData | URLSearchParams;
  timeout?: number;
}

interface CleanFetchResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T;
  headers: Headers;
}

/**
 * Makes an HTTP request with clean headers, ensuring no infrastructure
 * headers are accidentally forwarded to external APIs.
 * 
 * This function explicitly constructs headers to prevent any Vercel
 * or other platform-specific headers from being included in outgoing requests.
 */
export async function cleanFetch<T = any>(
  url: string, 
  options: CleanFetchOptions = {}
): Promise<CleanFetchResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000
  } = options;

  // Create a clean headers object - only include explicitly provided headers
  const cleanHeaders: Record<string, string> = {};
  
  // Copy only the headers we explicitly want to send
  Object.entries(headers).forEach(([key, value]) => {
    // Filter out any infrastructure headers that might have been passed accidentally
    const lowerKey = key.toLowerCase();
    if (!lowerKey.startsWith('x-vercel-') && 
        !lowerKey.startsWith('x-forwarded-') &&
        lowerKey !== 'forwarded' &&
        lowerKey !== 'x-real-ip' &&
        lowerKey !== 'host' &&
        lowerKey !== 'connection' &&
        lowerKey !== 'user-agent' && // Use our own user-agent if needed
        !lowerKey.startsWith('sec-') &&
        !lowerKey.startsWith('upgrade-')) {
      cleanHeaders[key] = value;
    }
  });

  // Set a custom user-agent for our application
  cleanHeaders['User-Agent'] = 'LAAC/1.0 (Location-Aware Access Control)';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: cleanHeaders,
      body,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let data: T;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text() as T;
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      headers: response.headers
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Helper function to create clean headers for Genesys Cloud API calls
 */
export function createGenesysHeaders(accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json'
  };
}

/**
 * Helper function to create clean headers for external API calls
 */
export function createCleanHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...additionalHeaders
  };
} 