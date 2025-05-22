import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/auth/verify';
import { userService } from '@/lib/saml/userService';
import { sign } from 'jsonwebtoken';

// Mock userService
jest.mock('@/lib/saml/userService', () => ({
  authenticate: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-token'),
}));

describe('Authentication API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 405 for non-POST requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res._getJSONData()).toEqual({ error: 'Method not allowed' });
  });

  test('returns 400 if email or password is missing', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        email: 'user@example.com',
        // password missing
      },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'Email and password are required' });
  });

  test('returns 401 for invalid credentials', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'wrong-password',
      },
    });

    // Mock authentication failure
    (userService.authenticate as jest.Mock).mockReturnValue(null);

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({ error: 'Invalid email or password' });
  });

  test('returns JWT token and user info for valid credentials', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'password123',
      },
    });

    // Mock authentication success
    const mockUser = {
      id: '1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
    };
    (userService.authenticate as jest.Mock).mockReturnValue(mockUser);

    await handler(req, res);

    // Check response
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      user: mockUser,
    });

    // Check that JWT was signed with correct payload
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        name: 'Test User',
        id: '1',
        role: 'user',
      }),
      expect.any(String),
      expect.objectContaining({ expiresIn: '1h' })
    );

    // Check that cookie was set
    const cookieHeader = res.getHeader('Set-Cookie');
    expect(cookieHeader).toBeDefined();
    expect(String(cookieHeader).includes('auth_token=test-token')).toBe(true);
  });
}); 