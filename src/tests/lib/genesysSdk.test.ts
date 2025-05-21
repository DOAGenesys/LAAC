import * as platformClient from 'purecloud-platform-client-v2';
import client, { initImplicitGrant, setAccessToken, getUsersApi } from '../../lib/genesysSdk';

// Mock the platformClient
jest.mock('purecloud-platform-client-v2', () => {
  return {
    ApiClient: {
      instance: {
        setEnvironment: jest.fn(),
        loginImplicitGrant: jest.fn(),
        setAccessToken: jest.fn(),
      }
    },
    UsersApi: jest.fn().mockImplementation(() => ({
      getUsersMe: jest.fn()
    }))
  };
});

describe('genesysSdk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window location for each test
    Object.defineProperty(window, 'location', {
      value: {
        hash: '',
        origin: 'http://localhost:3000',
      },
      writable: true,
    });
  });

  it('should export the API client instance', () => {
    expect(client).toBe(platformClient.ApiClient.instance);
  });

  describe('initImplicitGrant', () => {
    it('should call loginImplicitGrant with correct parameters', () => {
      const redirectUri = 'http://localhost:3000/callback';
      initImplicitGrant(redirectUri);
      expect(platformClient.ApiClient.instance.loginImplicitGrant).toHaveBeenCalledWith(
        'test-implicit-client-id',
        redirectUri
      );
    });

    it('should not call loginImplicitGrant if client ID is missing', () => {
      const originalEnv = process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID;
      process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID = '';
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      initImplicitGrant('http://localhost:3000/callback');
      
      expect(platformClient.ApiClient.instance.loginImplicitGrant).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      
      // Restore env
      process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID = originalEnv;
      consoleSpy.mockRestore();
    });
  });

  describe('setAccessToken', () => {
    it('should call setAccessToken on the ApiClient instance', () => {
      const token = 'test-token';
      setAccessToken(token);
      expect(platformClient.ApiClient.instance.setAccessToken).toHaveBeenCalledWith(token);
    });
  });

  describe('getUsersApi', () => {
    it('should return a new UsersApi instance', () => {
      const api = getUsersApi();
      expect(platformClient.UsersApi).toHaveBeenCalled();
      expect(api).toHaveProperty('getUsersMe');
    });
  });
}); 