import { getClientCredentialsToken } from '../../lib/oauthService';

// Mock fetch response
const mockToken = {
  access_token: 'test-access-token',
  expires_in: 3600, // 1 hour
};

describe('oauthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getClientCredentialsToken', () => {
    it('should fetch and return a token', async () => {
      // Mock successful fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockToken),
      });

      const token = await getClientCredentialsToken();

      // Verify the request
      expect(global.fetch).toHaveBeenCalledWith(
        'https://login.mypurecloud.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );

      // Verify the result
      expect(token).toBe(mockToken.access_token);
    });

    it('should throw an error if region is missing', async () => {
      const originalRegion = process.env.NEXT_PUBLIC_GC_REGION;
      process.env.NEXT_PUBLIC_GC_REGION = '';

      await expect(getClientCredentialsToken()).rejects.toThrow(
        'Missing NEXT_PUBLIC_GC_REGION environment variable'
      );

      // Restore env
      process.env.NEXT_PUBLIC_GC_REGION = originalRegion;
    });

    it('should throw an error if client credentials are missing', async () => {
      const originalClientId = process.env.GC_CC_CLIENT_ID;
      process.env.GC_CC_CLIENT_ID = '';

      await expect(getClientCredentialsToken()).rejects.toThrow(
        'Missing client credentials environment variables'
      );

      // Restore env
      process.env.GC_CC_CLIENT_ID = originalClientId;
    });

    it('should throw an error if fetch request fails', async () => {
      // Mock failed fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValueOnce('Unauthorized'),
      });

      await expect(getClientCredentialsToken()).rejects.toThrow(
        'Failed to obtain token: 401 Unauthorized'
      );
    });

    it('should use cached token if not expired', async () => {
      // First call should fetch a new token
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockToken),
      });

      await getClientCredentialsToken();
      
      // Reset mock to verify it's not called again
      (global.fetch as jest.Mock).mockReset();

      // Second call should use cached token
      const token = await getClientCredentialsToken();
      
      expect(global.fetch).not.toHaveBeenCalled();
      expect(token).toBe(mockToken.access_token);
    });
  });
}); 