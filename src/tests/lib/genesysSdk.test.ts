import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the env module
jest.mock('../../lib/env', () => ({
  getEnvironmentVariables: jest.fn(() => ({
    GC_REGION: 'mypurecloud.com',
    LAAC_COMPLIANT_COUNTRY: 'Switzerland'
  })),
  isServer: jest.fn(() => false)
}));

// Mock window and document for browser environment
Object.defineProperty(global, 'window', {
  value: {
    document: {
      head: {
        appendChild: jest.fn(),
      },
      getElementById: jest.fn(),
      createElement: jest.fn(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    },
  },
});

describe('genesysSdk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export the expected functions', () => {
    const genesysSdk = require('../../lib/genesysSdk');
    
    expect(genesysSdk.setAccessToken).toBeDefined();
    expect(genesysSdk.getUsersApi).toBeDefined();
    expect(genesysSdk.getPlatformClient).toBeDefined();
    expect(genesysSdk.default).toBeDefined();
  });

  it('should handle server-side calls gracefully', async () => {
    // Mock isServer to return true
    const { isServer } = require('../../lib/env');
    (isServer as jest.Mock).mockReturnValue(true);
    
    const { setAccessToken, getPlatformClient } = require('../../lib/genesysSdk');
    
    // Should not throw on server
    await setAccessToken('test-token');
    expect(getPlatformClient()).toBeNull();
  });

  it('should not have OAuth implicit grant functionality', () => {
    const genesysSdk = require('../../lib/genesysSdk');
    
    // Should not export initImplicitGrant
    expect(genesysSdk.initImplicitGrant).toBeUndefined();
    expect(genesysSdk.default.initImplicitGrant).toBeUndefined();
  });
}); 